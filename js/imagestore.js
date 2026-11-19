// Guarda las imágenes subidas en IndexedDB (persisten entre visitas, solo en este navegador).

const DB_NAME = 'focus-timer'
const STORE = 'images'
const MAX_SIDE = 2560

let dbPromise = null

function openDb() {
	if (!dbPromise) {
		dbPromise = new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, 1)
			req.onupgradeneeded = () => {
				req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
			}
			req.onsuccess = () => resolve(req.result)
			req.onerror = () => reject(req.error)
		})
	}
	return dbPromise
}

async function tx(mode, fn) {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const t = db.transaction(STORE, mode)
		const req = fn(t.objectStore(STORE))
		t.oncomplete = () => resolve(req.result)
		t.onerror = () => reject(t.error)
		t.onabort = () => reject(t.error)
	})
}

// Reduce imágenes enormes para que carguen rápido y ocupen poco
async function shrink(file) {
	try {
		const bmp = await createImageBitmap(file)
		const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
		if (scale === 1 && file.size < 3_000_000) {
			bmp.close()
			return file
		}
		const canvas = document.createElement('canvas')
		canvas.width = Math.round(bmp.width * scale)
		canvas.height = Math.round(bmp.height * scale)
		canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
		bmp.close()
		return await new Promise(r => canvas.toBlob(b => r(b || file), 'image/jpeg', 0.88))
	} catch {
		return file
	}
}

export async function addImage(file) {
	const blob = await shrink(file)
	return tx('readwrite', s => s.add({ blob, name: file.name || 'imagen', added: Date.now() }))
}

export function getImage(id) {
	return tx('readonly', s => s.get(id))
}

export function listImages() {
	return tx('readonly', s => s.getAll())
}

export function deleteImage(id) {
	return tx('readwrite', s => s.delete(id))
}
