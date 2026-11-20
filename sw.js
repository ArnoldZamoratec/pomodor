// Service worker: permite instalar Focus Timer como app y usarla sin internet.
// - Código (HTML/JS/CSS): primero la red, para recibir las actualizaciones; si no hay red, la copia guardada.
// - Imágenes, sonidos y fuentes: primero la copia guardada (no cambian).
// Al cambiar archivos del "esqueleto", sube VERSION para renovar la caché.

const VERSION = 'v6'
const CACHE = `focus-timer-${VERSION}`

const SOUNDS = ['rain', 'forest', 'fire', 'coffee', 'waves', 'wind', 'fan', 'clock', 'white', 'pink', 'brown']

const SHELL = [
	'./',
	'index.html',
	'styles.css',
	'manifest.webmanifest',
	'js/app.js',
	'js/sounds.js',
	'js/quotes.js',
	'js/imagestore.js',
	'js/cloud.js',
	'favicons/favicon-16x16.png',
	'favicons/favicon-32x32.png',
	'favicons/apple-touch-icon.png',
	'favicons/android-chrome-192x192.png',
	'favicons/android-chrome-512x512.png',
	'img/tomato.png',
	'favicons/maskable-512x512.png',
	...SOUNDS.map(s => `img/sounds/${s}.jpg`)
]

self.addEventListener('install', e => {
	e.waitUntil(
		caches
			.open(CACHE)
			.then(c => c.addAll(SHELL))
			.then(() => self.skipWaiting())
	)
})

self.addEventListener('activate', e => {
	e.waitUntil(
		caches
			.keys()
			.then(keys => Promise.all(keys.filter(k => k.startsWith('focus-timer-') && k !== CACHE).map(k => caches.delete(k))))
			.then(() => self.clients.claim())
	)
})

self.addEventListener('fetch', e => {
	const req = e.request
	if (req.method !== 'GET') return
	const url = new URL(req.url)

	// Fuentes de Google y SDK de Firebase: se guardan la primera vez
	if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.pathname.startsWith('/firebasejs/')) {
		e.respondWith(cacheFirst(req))
		return
	}
	// Fotos de fondo de otros sitios: no se tocan
	if (url.origin !== location.origin) return

	if (url.pathname.endsWith('.mp3')) {
		e.respondWith(audio(req))
	} else if (req.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname)) {
		e.respondWith(networkFirst(req))
	} else {
		e.respondWith(cacheFirst(req))
	}
})

async function networkFirst(req) {
	const cache = await caches.open(CACHE)
	try {
		// no-cache: siempre pregunta al servidor si hay una versión nueva
		const res = await fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
		if (res.ok) cache.put(req, res.clone())
		return res
	} catch {
		return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || Response.error()
	}
}

async function cacheFirst(req) {
	const cache = await caches.open(CACHE)
	const hit = await cache.match(req)
	if (hit) return hit
	const res = await fetch(req)
	if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
	return res
}

// Los <audio> piden el archivo por partes (Range). Guardamos el archivo completo
// la primera vez y luego servimos la parte pedida desde la caché.
async function audio(req) {
	const cache = await caches.open(CACHE)
	const key = new Request(req.url)
	let full = await cache.match(key)
	if (!full) {
		try {
			const res = await fetch(key)
			if (!res.ok) return res
			await cache.put(key, res.clone())
			full = res
		} catch {
			return fetch(req)
		}
	}
	const range = req.headers.get('range')
	if (!range) return full

	const buf = await full.arrayBuffer()
	const m = /bytes=(\d*)-(\d*)/.exec(range)
	const size = buf.byteLength
	let start = m && m[1] ? Number(m[1]) : 0
	let end = m && m[2] ? Number(m[2]) : size - 1
	if (m && !m[1] && m[2]) {
		start = size - Number(m[2])
		end = size - 1
	}
	end = Math.min(end, size - 1)
	if (start >= size || start > end) {
		return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
	}
	return new Response(buf.slice(start, end + 1), {
		status: 206,
		headers: {
			'Content-Type': 'audio/mpeg',
			'Content-Range': `bytes ${start}-${end}/${size}`,
			'Content-Length': String(end - start + 1),
			'Accept-Ranges': 'bytes'
		}
	})
}
