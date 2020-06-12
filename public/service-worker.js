importScripts('workbox-sw.prod.v2.1.3.js');
importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

const workboxSW = new self.WorkboxSW();
workboxSW.router.registerRoute(
    /.*(?:googleapis|gstatic)\.com.*$/,
    workboxSW.strategies.staleWhileRevalidate({
        cacheName: 'google-fonts',
        cacheExpiration: {
            maxEntries: 3,
            maxAgeSeconds: 60 * 60 * 24 * 30,
        },
    })
);

workboxSW.router.registerRoute(
    /.*(?:firebasestorage\.googleapis)\.com.*$/,
    workboxSW.strategies.staleWhileRevalidate({
        cacheName: 'post-images',
    })
);

workboxSW.router.registerRoute(
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
    workboxSW.strategies.staleWhileRevalidate({
        cacheName: 'material-css',
    })
);

workboxSW.router.registerRoute(
    'https://pwa-test-2d34f.firebaseio.com/posts.json',
    function (args) {
        return fetch(args.event.request).then(function (res) {
            var clonedRes = res.clone();
            clearAllData('posts')
                .then(function () {
                    return clonedRes.json();
                })
                .then(function (data) {
                    for (var key in data) {
                        writeData('posts', data[key]);
                    }
                });
            return res;
        });
    }
);

workboxSW.router.registerRoute(
    function (routeData) {
        return routeData.event.request.headers
            .get('accept')
            .includes('text/html');
    },
    function (args) {
        return caches.match(args.event.request).then(function (response) {
            if (response) {
                return response;
            } else {
                return fetch(args.event.request)
                    .then(function (res) {
                        return caches.open('dynamic').then(function (cache) {
                            cache.put(args.event.request.url, res.clone());
                            return res;
                        });
                    })
                    .catch(function (err) {
                        return caches
                            .match('/offline.html')
                            .then(function (res) {
                                return res;
                            });
                    });
            }
        });
    }
);
workboxSW.precache([
  {
    "url": "favicon.ico",
    "revision": "2cab47d9e04d664d93c8d91aec59e812"
  },
  {
    "url": "help/index.html",
    "revision": "30a878b3525d42c84f93daf0c4bb8f50"
  },
  {
    "url": "index.html",
    "revision": "2ff81c06847fae1661ba69f18d54a1a9"
  },
  {
    "url": "manifest.json",
    "revision": "d11c7965f5cfba711c8e74afa6c703d7"
  },
  {
    "url": "offline.html",
    "revision": "45352e71a80a5c75d25e226e7330871b"
  },
  {
    "url": "src/css/app.css",
    "revision": "f27b4d5a6a99f7b6ed6d06f6583b73fa"
  },
  {
    "url": "src/css/feed.css",
    "revision": "fed0b69be8bea8a7e976ba5f4ae53d6d"
  },
  {
    "url": "src/css/help.css",
    "revision": "1c6d81b27c9d423bece9869b07a7bd73"
  },
  {
    "url": "src/images/main-image-lg.jpg",
    "revision": "31b19bffae4ea13ca0f2178ddb639403"
  },
  {
    "url": "src/images/main-image-sm.jpg",
    "revision": "c6bb733c2f39c60e3c139f814d2d14bb"
  },
  {
    "url": "src/images/main-image.jpg",
    "revision": "5c66d091b0dc200e8e89e56c589821fb"
  },
  {
    "url": "src/images/sf-boat.jpg",
    "revision": "0f282d64b0fb306daf12050e812d6a19"
  },
  {
    "url": "src/js/app.min.js",
    "revision": "ad053cf39e7ba06a3bf0d8d04d4ff843"
  },
  {
    "url": "src/js/feed.min.js",
    "revision": "ca7115bb6e854ee1d175afd62e9d44be"
  },
  {
    "url": "src/js/fetch.min.js",
    "revision": "4174e53d81ed161be169bc7981cf6d49"
  },
  {
    "url": "src/js/idb.min.js",
    "revision": "88ae80318659221e372dd0d1da3ecf9a"
  },
  {
    "url": "src/js/material.min.js",
    "revision": "713af0c6ce93dbbce2f00bf0a98d0541"
  },
  {
    "url": "src/js/promise.min.js",
    "revision": "abe12e93553296bf22d99b57a03ab62d"
  },
  {
    "url": "src/js/utility.min.js",
    "revision": "a4d4cb3fb469d7c5e563403c9bac634c"
  }
]);

self.addEventListener('sync', function (event) {
    console.log('[Service Worker] Background syncing', event);
    if (event.tag === 'sync-new-posts') {
        console.log('[Service Worker] Syncing new Posts');
        event.waitUntil(
            readAllData('sync-posts').then(function (data) {
                for (var dt of data) {
                    var postData = new FormData();
                    postData.append('id', dt.id);
                    postData.append('title', dt.title);
                    postData.append('location', dt.location);
                    postData.append('rawLocationLat', dt.rawLocation.lat);
                    postData.append('rawLocationLng', dt.rawLocation.lng);
                    postData.append('file', dt.picture, dt.id + '.png');

                    fetch(
                        'https://us-central1-pwa-test-2d34f.cloudfunctions.net/storePostData',
                        {
                            method: 'POST',
                            body: postData,
                        }
                    )
                        .then(function (res) {
                            console.log('Sent data', res);
                            if (res.ok) {
                                res.json().then(function (resData) {
                                    deleteItemFromData(
                                        'sync-posts',
                                        resData.id
                                    );
                                });
                            }
                        })
                        .catch(function (err) {
                            console.log('Error while sending data', err);
                        });
                }
            })
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    var notification = event.notification;
    var action = event.action;

    console.log(notification);

    if (action === 'confirm') {
        console.log('Confirm was chosen');
        notification.close();
    } else {
        console.log(action);
        event.waitUntil(
            clients.matchAll().then(function (clis) {
                var client = clis.find(function (c) {
                    return c.visibilityState === 'visible';
                });

                if (client !== undefined) {
                    client.navigate(notification.data.url);
                    client.focus();
                } else {
                    clients.openWindow(notification.data.url);
                }
                notification.close();
            })
        );
    }
});

self.addEventListener('notificationclose', function (event) {
    console.log('Notification was closed', event);
});

self.addEventListener('push', function (event) {
    console.log('Push Notification received', event);

    var data = {
        title: 'New!',
        content: 'Something new happened!',
        openUrl: '/',
    };

    if (event.data) {
        data = JSON.parse(event.data.text());
    }

    var options = {
        body: data.content,
        icon: '/src/images/icons/app-icon-96x96.png',
        badge: '/src/images/icons/app-icon-96x96.png',
        data: {
            url: data.openUrl,
        },
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});
