/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'kin-gallery-v1';
const STATIC_CACHE_NAME = 'kin-gallery-static-v1';
const MEDIA_CACHE_NAME = 'kin-gallery-media-v1';

// Cache up to 50 recent media items offline
const MAX_MEDIA_CACHE_SIZE = 50;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg'
];

// API endpoints that should work offline with cached data
const OFFLINE_FALLBACK_ROUTES = [
  '/api/media',
  '/api/children',
  '/api/comments'
];

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then(cache => {
        return cache.addAll(STATIC_ASSETS);
      }),
      // Initialize offline queue in IndexedDB
      initializeOfflineQueue()
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => 
              cacheName.startsWith('kin-gallery-') && 
              ![CACHE_NAME, STATIC_CACHE_NAME, MEDIA_CACHE_NAME].includes(cacheName)
            )
            .map(cacheName => caches.delete(cacheName))
        );
      }),
      // Claim all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.includes('/media/')) {
    event.respondWith(handleMediaRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful GET responses
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    // Process successful POST/PUT/DELETE requests
    if (response.ok && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
      await processSuccessfulMutation(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache for GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Return offline fallback for supported routes
      if (OFFLINE_FALLBACK_ROUTES.some(route => url.pathname.startsWith(route))) {
        return new Response(JSON.stringify({
          error: 'Offline - showing cached data',
          offline: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // For mutations, queue them for later
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      await queueRequestForLater(request);
      return new Response(JSON.stringify({
        success: true,
        queued: true,
        message: 'Request queued for when online'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Handle media requests with cache-first strategy
async function handleMediaRequest(request: Request): Promise<Response> {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache media files but limit cache size
      await addToMediaCache(cache, request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return offline fallback image
    return new Response('Offline - media not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle static assets with cache-first strategy
async function handleStaticRequest(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await cache.match('/');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// Add media to cache with size limit
async function addToMediaCache(cache: Cache, request: Request, response: Response): Promise<void> {
  const keys = await cache.keys();
  
  // If cache is full, remove oldest entries
  if (keys.length >= MAX_MEDIA_CACHE_SIZE) {
    const oldestKey = keys[0];
    if (oldestKey) {
      await cache.delete(oldestKey);
    }
  }
  
  await cache.put(request, response);
}

// Queue failed requests for later retry
async function queueRequestForLater(request: Request): Promise<void> {
  const queuedRequest: QueuedRequest = {
    id: crypto.randomUUID(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: request.method !== 'GET' ? await request.text() : undefined,
    timestamp: Date.now()
  };
  
  // Store in IndexedDB (simplified implementation)
  try {
    const db = await openOfflineDatabase();
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    await store.add(queuedRequest);
  } catch (error) {
    console.error('Failed to queue request:', error);
  }
}

// Process successful mutations (clear relevant caches)
async function processSuccessfulMutation(request: Request, response: Response): Promise<void> {
  const url = new URL(request.url);
  
  // Clear relevant caches when data is modified
  if (url.pathname.includes('/upload')) {
    // Clear media cache
    await caches.delete(CACHE_NAME);
  } else if (url.pathname.includes('/comments')) {
    // Clear comments cache
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const commentKeys = keys.filter(req => req.url.includes('/api/comments'));
    await Promise.all(commentKeys.map(key => cache.delete(key)));
  }
}

// Initialize IndexedDB for offline queue
async function initializeOfflineQueue(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('KinGalleryOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('requests')) {
        const store = db.createObjectStore('requests', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

// Open offline database
async function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('KinGalleryOffline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Listen for sync events to process queued requests
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(processQueuedRequests());
  }
});

// Process queued requests when back online
async function processQueuedRequests(): Promise<void> {
  try {
    const db = await openOfflineDatabase();
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    const requests = await store.getAll();
    
    for (const queuedRequest of requests) {
      try {
        const request = new Request(queuedRequest.url, {
          method: queuedRequest.method,
          headers: queuedRequest.headers,
          body: queuedRequest.body
        });
        
        const response = await fetch(request);
        
        if (response.ok) {
          // Remove from queue on success
          await store.delete(queuedRequest.id);
          
          // Notify clients of successful sync
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_SUCCESS',
              request: queuedRequest
            });
          });
        }
      } catch (error) {
        console.error('Failed to sync request:', error);
        // Keep in queue for next sync attempt
      }
    }
  } catch (error) {
    console.error('Failed to process queued requests:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});