import { SOUND_LIST, SoundEngine } from './sounds.js'
import { QUOTES } from './quotes.js'
import { addImage, getImage, listImages, deleteImage } from './imagestore.js'

const $ = sel => document.querySelector(sel)
const sounds = SoundEngine()

// ---------- Iconos de línea (sprite SVG en index.html) ----------
const icon = (name, size = 20) =>
	`<svg class="ic" width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"/></svg>`

function setIcon(svg, name) {
	svg.querySelector('use').setAttribute('href', `#i-${name}`)
}

// ---------- Almacenamiento seguro ----------
const store = {
	get(key, fallback) {
		try {
			const v = localStorage.getItem('ft:' + key)
			return v === null ? fallback : JSON.parse(v)
		} catch {
			return fallback
		}
	},
	set(key, value) {
		try {
			localStorage.setItem('ft:' + key, JSON.stringify(value))
		} catch {}
	}
}

const todayKey = () => new Date().toISOString().slice(0, 10)

// ---------- Estado ----------
const settings = Object.assign(
	{ work: 25, short: 5, long: 15, rounds: 4, autoStart: true, topic: '', imageQuery: '', theme: 'theme-dark', bgUpload: null },
	store.get('settings', {})
)
let tasks = store.get('tasks', [])
let log = store.get('log', { date: todayKey(), items: [] })
if (log.date !== todayKey()) log = { date: todayKey(), items: [] }
let soundVolumes = store.get('volumes', {})

let mode = 'work'
let round = 1
let remaining = settings.work * 60
let endAt = null
let ticker = null
let imageSeed = Math.floor(Math.random() * 1000)

const MODE_INFO = {
	work: { label: 'Enfoque', minutes: () => settings.work },
	short: { label: 'Descanso', minutes: () => settings.short },
	long: { label: 'Descanso largo', minutes: () => settings.long }
}

const CIRC = 2 * Math.PI * 100

// ---------- Elementos ----------
const el = {
	topic: $('#topicInput'),
	imageQuery: $('#imageQuery'),
	imageHint: $('#imageHint'),
	work: $('#workMin'),
	short: $('#shortMin'),
	long: $('#longMin'),
	rounds: $('#rounds'),
	autoStart: $('#autoStart'),
	time: $('#timeDisplay'),
	ring: $('#ringProgress'),
	play: $('#playBtn'),
	reset: $('#resetBtn'),
	skip: $('#skipBtn'),
	nowLabel: $('#nowLabel'),
	nowTopic: $('#nowTopic'),
	dots: $('#roundDots'),
	roundText: $('#roundText'),
	taskForm: $('#taskForm'),
	taskInput: $('#taskInput'),
	taskList: $('#taskList'),
	soundGrid: $('#soundGrid'),
	logList: $('#logList'),
	todayCount: $('#todayCount'),
	bg: $('#bg'),
	toast: $('#toast'),
	toastIcon: $('#toastIcon'),
	toastText: $('#toastText'),
	themeBtn: $('#themeBtn'),
	themeIcon: $('#themeIcon'),
	nowIcon: $('#nowIcon'),
	todayNumber: $('#todayNumber'),
	quote: $('#quote'),
	quoteText: $('#quoteText'),
	quoteAuthor: $('#quoteAuthor')
}

el.ring.style.strokeDasharray = CIRC

// ---------- Utilidades ----------
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

let toastTimer
function toast(msg, iconName = 'check') {
	el.toastText.textContent = msg
	setIcon(el.toastIcon, iconName)
	el.toast.classList.add('show')
	clearTimeout(toastTimer)
	toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3400)
}

// ---------- Frases ----------
const QUOTE_EVERY = 45000
let quoteTimer
let lastQuote = {}

function showQuote() {
	const list = QUOTES[mode]
	let i
	do i = Math.floor(Math.random() * list.length)
	while (list.length > 1 && i === lastQuote[mode])
	lastQuote[mode] = i
	const q = list[i]

	el.quote.classList.add('swap')
	setTimeout(() => {
		el.quoteText.textContent = q.t
		el.quoteAuthor.textContent = q.a ? `— ${q.a}` : ''
		el.quote.classList.remove('swap')
	}, 450)

	clearInterval(quoteTimer)
	quoteTimer = setInterval(showQuote, QUOTE_EVERY)
}

function saveSettings() {
	store.set('settings', settings)
}

const isRunning = () => endAt !== null
const totalSeconds = () => MODE_INFO[mode].minutes() * 60

// ---------- Render ----------
function renderTimer() {
	el.time.textContent = fmt(remaining)
	const progress = 1 - remaining / totalSeconds()
	el.ring.style.strokeDashoffset = CIRC * progress
	el.play.classList.toggle('running', isRunning())
	el.play.setAttribute('aria-label', isRunning() ? 'Pausar' : 'Empezar')

	const topic = settings.topic.trim()
	document.title = `${fmt(remaining)} · ${MODE_INFO[mode].label}${topic && mode === 'work' ? ' — ' + topic : ''}`
}

function renderHeader() {
	document.body.dataset.mode = mode
	document.querySelectorAll('.mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode))

	const topic = settings.topic.trim()
	const current = tasks.find(t => t.current && !t.done)
	if (mode === 'work') {
		el.nowLabel.textContent = current ? `Tarea actual: ${current.text}` : 'Ahora estoy haciendo'
		el.nowTopic.textContent = topic || 'Escribe tu tema a la izquierda'
		setIcon(el.nowIcon, topic ? 'target' : 'pencil')
	} else if (mode === 'short') {
		el.nowLabel.textContent = 'Tiempo de descanso'
		el.nowTopic.textContent = 'Respira y toma agua'
		setIcon(el.nowIcon, 'droplet')
	} else {
		el.nowLabel.textContent = 'Descanso largo, te lo ganaste'
		el.nowTopic.textContent = 'Sal a caminar un rato'
		setIcon(el.nowIcon, 'sunset')
	}

	el.dots.innerHTML = ''
	for (let i = 1; i <= settings.rounds; i++) {
		const d = document.createElement('span')
		if (i < round || (i === round && mode !== 'work')) d.classList.add('done')
		if (i === round && mode === 'work') d.classList.add('current')
		el.dots.appendChild(d)
	}
	el.roundText.textContent = `Ronda ${round} de ${settings.rounds}`
	renderTimer()
}

function renderTasks() {
	el.taskList.innerHTML = ''
	if (!tasks.length) {
		el.taskList.innerHTML = '<li class="empty">Divide tu tema en pasos pequeños y añádelos aquí.</li>'
		return
	}
	tasks.forEach((t, i) => {
		const li = document.createElement('li')
		li.classList.toggle('done', t.done)
		li.classList.toggle('current', Boolean(t.current) && !t.done)

		const cb = document.createElement('input')
		cb.type = 'checkbox'
		cb.checked = t.done
		cb.addEventListener('change', () => {
			t.done = cb.checked
			if (t.done) {
				t.current = false
				toast('Tarea completada', 'check')
			}
			saveTasks()
		})

		const span = document.createElement('span')
		span.textContent = t.text
		span.title = 'Clic para marcarla como tarea actual'
		span.addEventListener('click', () => {
			const wasCurrent = t.current
			tasks.forEach(x => (x.current = false))
			t.current = !wasCurrent && !t.done
			saveTasks()
		})

		const del = document.createElement('button')
		del.innerHTML =
			'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
		del.setAttribute('aria-label', `Eliminar ${t.text}`)
		del.addEventListener('click', () => {
			tasks.splice(i, 1)
			saveTasks()
		})

		li.append(cb, span, del)
		el.taskList.appendChild(li)
	})
}

function saveTasks() {
	store.set('tasks', tasks)
	renderTasks()
	renderHeader()
}

function renderLog() {
	const done = log.items.length
	el.todayNumber.textContent = done
	el.logList.innerHTML = ''
	if (!done) {
		el.logList.innerHTML = '<li class="empty">Aquí aparecerá cada pomodoro que termines.</li>'
		return
	}
	const totalMin = log.items.reduce((a, b) => a + b.minutes, 0)
	const hours = Math.floor(totalMin / 60)
	const summary = document.createElement('li')
	summary.className = 'summary'
	summary.innerHTML = icon('brand', 20)
	summary.append(
		`${done} ${done === 1 ? 'pomodoro' : 'pomodoros'}, ${hours ? hours + ' h ' : ''}${totalMin % 60} min de enfoque`
	)
	el.logList.appendChild(summary)
	log.items
		.slice()
		.reverse()
		.forEach(item => {
			const li = document.createElement('li')
			const time = document.createElement('span')
			time.textContent = item.time
			const what = document.createElement('b')
			what.textContent = item.topic || 'Sin tema'
			const mins = document.createElement('span')
			mins.textContent = `${item.minutes} min`
			li.append(time, what, mins)
			el.logList.appendChild(li)
		})
}

// ---------- Temporizador ----------
function tick() {
	remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000))
	renderTimer()
	if (remaining <= 0) complete()
}

function start() {
	if (isRunning()) return
	if (remaining <= 0) remaining = totalSeconds()
	endAt = Date.now() + remaining * 1000
	ticker = setInterval(tick, 250)
	if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
	if (mode === 'work' && !settings.topic.trim()) toast('Escribe en qué vas a trabajar para tenerlo presente', 'pencil')
	renderTimer()
}

function pause() {
	if (!isRunning()) return
	clearInterval(ticker)
	remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000))
	endAt = null
	renderTimer()
}

function reset() {
	pause()
	remaining = totalSeconds()
	renderTimer()
}

function setMode(newMode) {
	pause()
	const changed = mode !== newMode
	mode = newMode
	remaining = totalSeconds()
	renderHeader()
	if (changed) showQuote()
}

function nextMode() {
	if (mode === 'work') {
		return round >= settings.rounds ? 'long' : 'short'
	}
	if (mode === 'short') round++
	else round = 1
	return 'work'
}

function notify(title, body) {
	try {
		if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
			new Notification(title, { body, icon: 'favicons/favicon-32x32.png' })
		}
	} catch {}
}

function complete() {
	clearInterval(ticker)
	endAt = null
	sounds.chime()

	if (mode === 'work') {
		const now = new Date()
		log.items.push({
			time: now.toTimeString().slice(0, 5),
			topic: settings.topic.trim(),
			minutes: settings.work
		})
		store.set('log', log)
		renderLog()
	}

	const finished = mode
	const next = nextMode()
	setMode(next)

	const [msg, iconName] =
		finished === 'work'
			? next === 'long'
				? ['Ciclo completo. Toca descanso largo.', 'trophy']
				: ['Pomodoro terminado. Toca descansar.', 'coffee']
			: ['Descanso terminado. A enfocarse otra vez.', 'flame']
	toast(msg, iconName)
	notify('Focus Timer', msg)

	if (settings.autoStart) start()
}

function skip() {
	sounds.click()
	const next = nextMode()
	setMode(next)
	toast(`Saltaste a: ${MODE_INFO[next].label.toLowerCase()}`, 'shuffle')
}

// ---------- Imagen de fondo ----------
// Palabras en español → escenas que se ven bien como foto de fondo.
// Las actividades (estudiar, programar…) se convierten en un lugar que inspira esa actividad.
const DICT = {
	// Actividades → escenas
	estudiar: 'library', estudio: 'library', estudiando: 'library', examen: 'library', tarea: 'library',
	tareas: 'library', universidad: 'university', colegio: 'library', clase: 'library',
	matematicas: 'library', fisica: 'observatory', quimica: 'laboratory', biologia: 'forest',
	historia: 'castle', geografia: 'mountains', filosofia: 'ancient ruins', medicina: 'library',
	derecho: 'library', economia: 'skyline', finanzas: 'skyline', marketing: 'skyline',
	programar: 'city night', programacion: 'city night', codigo: 'city night', software: 'city night',
	computadora: 'city night', informatica: 'city night',
	leer: 'library', lectura: 'library', libro: 'library', libros: 'library', escribir: 'lake',
	escritura: 'lake', novela: 'lake', poesia: 'flowers',
	trabajo: 'skyline', trabajar: 'skyline', oficina: 'skyline', proyecto: 'skyline', reunion: 'skyline',
	musica: 'concert hall', guitarra: 'concert hall', piano: 'concert hall', cantar: 'concert hall',
	arte: 'museum', dibujar: 'museum', dibujo: 'museum', pintar: 'museum', pintura: 'museum',
	diseno: 'architecture', arquitectura: 'architecture', fotografia: 'landscape', video: 'landscape',
	ejercicio: 'mountains', gimnasio: 'mountains', correr: 'trail', yoga: 'beach', meditar: 'zen garden',
	meditacion: 'zen garden', cocina: 'market', cocinar: 'market', limpiar: 'meadow',
	ingles: 'london', idiomas: 'old town', frances: 'paris', aleman: 'berlin', italiano: 'rome',
	japones: 'japan temple', chino: 'great wall', juegos: 'city night', videojuegos: 'city night',
	// Lugares y ambientes
	naturaleza: 'nature', playa: 'beach', mar: 'sea', oceano: 'ocean', montana: 'mountains', montanas: 'mountains',
	bosque: 'forest', selva: 'rainforest', ciudad: 'city', noche: 'night sky', lluvia: 'rain', cafe: 'cafe',
	cafeteria: 'cafe', espacio: 'galaxy', estrellas: 'milky way', galaxia: 'galaxy', biblioteca: 'library',
	japon: 'japan', otono: 'autumn', invierno: 'winter', nieve: 'snow', flores: 'flowers', lago: 'lake',
	rio: 'river', atardecer: 'sunset', amanecer: 'sunrise', cielo: 'sky', desierto: 'desert', campo: 'meadow',
	jardin: 'garden', cascada: 'waterfall', volcan: 'volcano', isla: 'island', aurora: 'aurora'
}

const STOP = new Set([
	'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'para', 'con', 'en', 'mi', 'mis', 'a',
	'del', 'al', 'por', 'que', 'hacer', 'hoy', 'sobre', 'tema', 'repasar', 'terminar', 'mas'
])

function toTags(text) {
	const words = text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.split(/\s+/)
		.filter(w => w && !STOP.has(w))
	const tags = words.map(w => DICT[w] || DICT[w.normalize('NFD').replace(/[̀-ͯ]/g, '')] || w)
	return [...new Set(tags)].slice(0, 3)
}

const imageCache = {}

// Busca fotos libres de alta calidad en Wikimedia Commons (sin clave). Devuelve lista de URLs horizontales.
async function searchImages(q) {
	if (imageCache[q]) return imageCache[q]
	try {
		const search = `${q} filetype:bitmap incategory:Quality_images`
		const res = await fetch(
			'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search' +
				'&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url|size&iiurlwidth=1920&gsrsearch=' +
				encodeURIComponent(search)
		)
		if (!res.ok) throw new Error(res.status)
		const data = await res.json()
		const urls = Object.values(data.query?.pages || {})
			.sort((a, b) => a.index - b.index)
			.map(p => p.imageinfo?.[0])
			.filter(i => i && i.width >= 1200 && i.width > i.height * 1.2)
			.map(i => i.thumburl || i.url)
		imageCache[q] = urls
		return urls
	} catch {
		return []
	}
}

function showImage(url, announce) {
	return new Promise(resolve => {
		const img = new Image()
		img.onload = () => {
			el.bg.style.backgroundImage = `url("${img.src}")`
			el.bg.classList.remove('loading')
			if (announce) toast('Fondo actualizado', 'image')
			resolve(true)
		}
		img.onerror = () => resolve(false)
		img.src = url
	})
}

let bgRequest = 0
let uploadUrl = null

// Muestra una imagen subida por el usuario (guardada en IndexedDB)
async function showUpload(id, announce) {
	const rec = await getImage(id).catch(() => null)
	if (!rec) return false
	if (uploadUrl) URL.revokeObjectURL(uploadUrl)
	uploadUrl = URL.createObjectURL(rec.blob)
	el.imageHint.textContent = `Usando tu imagen “${rec.name}”.`
	return showImage(uploadUrl, announce)
}

async function loadBackground(announce = false) {
	const req = ++bgRequest
	el.bg.classList.add('loading')
	markGallery()

	if (settings.bgUpload != null) {
		if (await showUpload(settings.bgUpload, announce)) return
		settings.bgUpload = null // la imagen ya no existe: vuelve a la búsqueda
		saveSettings()
		markGallery()
	}

	const raw = (settings.imageQuery || settings.topic || '').trim()

	if (/^https?:\/\//i.test(raw)) {
		if (!(await showImage(raw, announce))) {
			el.bg.classList.remove('loading')
			toast('Esa URL no es una imagen válida. Prueba con otra.', 'image')
		}
		return
	}

	const tags = toTags(raw)
	let q = tags.length ? tags.join(' ') : 'mountain lake'
	el.imageHint.textContent = `Buscando: ${q}…`
	let urls = await searchImages(q)
	// Si con todas las palabras hay pocos resultados, prueba palabra por palabra
	for (let i = 0; urls.length < 3 && i < tags.length && tags.length > 1; i++) {
		const alt = await searchImages(tags[i])
		if (alt.length > urls.length) {
			urls = alt
			q = tags[i]
		}
	}
	if (req !== bgRequest) return

	// Prueba hasta 4 resultados por si alguno no carga
	for (let i = 0; i < Math.min(4, urls.length); i++) {
		const url = urls[(imageSeed + i) % urls.length]
		if (await showImage(url, announce)) {
			if (req === bgRequest) el.imageHint.textContent = `Mostrando “${q}”. Hay ${urls.length} fotos; usa el botón de mezclar para ver otra.`
			return
		}
		if (req !== bgRequest) return
	}

	// Respaldo: foto aleatoria bonita
	el.imageHint.textContent = `Sin resultados para “${q}”, mostrando una al azar.`
	if (!(await showImage(`https://picsum.photos/seed/${imageSeed}/1920/1080`, announce))) {
		el.bg.classList.remove('loading')
	}
}

// ---------- Sonidos ----------
function renderSounds() {
	SOUND_LIST.forEach(s => {
		const card = document.createElement('div')
		card.className = 'sound'
		const btn = document.createElement('button')
		btn.className = 'photo'
		btn.style.backgroundImage = `url("img/sounds/${s.id}.jpg")`
		btn.innerHTML = `<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="name">${s.name}</span>`
		btn.setAttribute('aria-pressed', 'false')
		const range = document.createElement('input')
		range.type = 'range'
		range.min = 0
		range.max = 1
		range.step = 0.01
		range.value = soundVolumes[s.id] ?? 0.5
		range.setAttribute('aria-label', `Volumen ${s.name}`)

		btn.addEventListener('click', () => {
			if (sounds.isActive(s.id)) {
				sounds.stop(s.id)
				card.classList.remove('active')
			} else {
				sounds.start(s, Number(range.value))
				card.classList.add('active')
			}
			btn.setAttribute('aria-pressed', String(sounds.isActive(s.id)))
		})
		range.addEventListener('input', () => {
			sounds.setVolume(s.id, Number(range.value))
			soundVolumes[s.id] = Number(range.value)
			store.set('volumes', soundVolumes)
		})

		card.append(btn, range)
		el.soundGrid.appendChild(card)
	})

	$('#stopSoundsBtn').addEventListener('click', () => {
		sounds.stopAll()
		document.querySelectorAll('.sound.active').forEach(c => {
			c.classList.remove('active')
			c.querySelector('button').setAttribute('aria-pressed', 'false')
		})
	})
}

// ---------- Tema claro/oscuro ----------
function applyTheme() {
	document.documentElement.className = settings.theme
	const dark = settings.theme === 'theme-dark'
	setIcon(el.themeIcon, dark ? 'sun' : 'moon')
	el.themeBtn.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro')
}

// ---------- Eventos ----------
function bindNumber(input, key, min, max) {
	input.value = settings[key]
	input.addEventListener('change', () => {
		const v = Math.min(max, Math.max(min, Math.round(Number(input.value) || settings[key])))
		input.value = v
		settings[key] = v
		saveSettings()
		if (key === 'rounds') round = Math.min(round, v)
		if (!isRunning() && key === mode) remaining = totalSeconds()
		renderHeader()
		markPreset()
	})
}

function markPreset() {
	document.querySelectorAll('[data-preset]').forEach(b => {
		const [w, s, l] = b.dataset.preset.split(',').map(Number)
		b.classList.toggle('on', settings.work === w && settings.short === s && settings.long === l)
	})
}

bindNumber(el.work, 'work', 1, 180)
bindNumber(el.short, 'short', 1, 60)
bindNumber(el.long, 'long', 1, 90)
bindNumber(el.rounds, 'rounds', 1, 12)

document.querySelectorAll('[data-preset]').forEach(b =>
	b.addEventListener('click', () => {
		const [w, s, l] = b.dataset.preset.split(',').map(Number)
		Object.assign(settings, { work: w, short: s, long: l })
		el.work.value = w
		el.short.value = s
		el.long.value = l
		saveSettings()
		if (!isRunning()) remaining = totalSeconds()
		renderHeader()
		markPreset()
		toast(`${w} min de enfoque y ${s} de descanso`, 'clock')
	})
)

el.autoStart.checked = settings.autoStart
el.autoStart.addEventListener('change', () => {
	settings.autoStart = el.autoStart.checked
	saveSettings()
})

el.topic.value = settings.topic
el.topic.addEventListener('input', () => {
	settings.topic = el.topic.value
	saveSettings()
	renderHeader()
})
el.topic.addEventListener('change', () => {
	if (!settings.imageQuery.trim() && settings.bgUpload == null) loadBackground(true)
})

// Buscar o mezclar vuelve a las fotos de internet (deja de usar la imagen subida)
function useSearch() {
	settings.bgUpload = null
	saveSettings()
	loadBackground(true)
}

el.imageQuery.value = settings.imageQuery
el.imageQuery.addEventListener('input', () => {
	settings.imageQuery = el.imageQuery.value
	saveSettings()
})
el.imageQuery.addEventListener('keydown', e => {
	if (e.key === 'Enter') useSearch()
})
$('#searchImageBtn').addEventListener('click', useSearch)
$('#shuffleImageBtn').addEventListener('click', () => {
	imageSeed = Math.floor(Math.random() * 100000)
	useSearch()
})

// ---------- Subir imágenes propias ----------
const gallery = $('#gallery')
const galleryUrls = []

async function renderGallery() {
	galleryUrls.splice(0).forEach(u => URL.revokeObjectURL(u))
	gallery.innerHTML = ''
	let images = []
	try {
		images = await listImages()
	} catch {
		return
	}
	images.reverse().forEach(img => {
		const url = URL.createObjectURL(img.blob)
		galleryUrls.push(url)
		const item = document.createElement('div')
		item.className = 'thumb'
		item.dataset.id = img.id

		const pick = document.createElement('button')
		pick.className = 'thumb-pick'
		pick.style.backgroundImage = `url("${url}")`
		pick.setAttribute('aria-label', `Usar ${img.name} de fondo`)
		pick.addEventListener('click', () => useUpload(img.id))

		const del = document.createElement('button')
		del.className = 'thumb-del'
		del.innerHTML = icon('x', 12)
		del.setAttribute('aria-label', `Borrar ${img.name}`)
		del.addEventListener('click', async () => {
			await deleteImage(img.id)
			if (settings.bgUpload === img.id) useSearch()
			renderGallery()
			toast('Imagen borrada', 'image')
		})

		item.append(pick, del)
		gallery.appendChild(item)
	})
	markGallery()
}

function markGallery() {
	gallery.querySelectorAll('.thumb').forEach(t =>
		t.classList.toggle('on', Number(t.dataset.id) === settings.bgUpload)
	)
}

function useUpload(id, announce = true) {
	settings.bgUpload = id
	saveSettings()
	loadBackground(announce)
}

async function handleFiles(fileList) {
	const files = [...fileList].filter(f => f.type.startsWith('image/'))
	if (!files.length) {
		toast('Ese archivo no es una imagen. Usa JPG, PNG o WebP.', 'image')
		return
	}
	let lastId = null
	for (const f of files) {
		try {
			lastId = await addImage(f)
		} catch {
			toast('No hay espacio para guardar más imágenes. Borra alguna.', 'image')
			break
		}
	}
	await renderGallery()
	if (lastId != null) {
		useUpload(lastId, false)
		toast(files.length > 1 ? `${files.length} imágenes subidas` : 'Imagen subida y puesta de fondo', 'upload')
	}
}

$('#uploadInput').addEventListener('change', e => {
	handleFiles(e.target.files)
	e.target.value = ''
})

// Arrastrar y soltar en cualquier parte de la página
const dropOverlay = $('#dropOverlay')
let dragDepth = 0
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files')

window.addEventListener('dragenter', e => {
	if (!hasFiles(e)) return
	e.preventDefault()
	dragDepth++
	dropOverlay.classList.add('show')
})
window.addEventListener('dragover', e => {
	if (hasFiles(e)) e.preventDefault()
})
window.addEventListener('dragleave', e => {
	if (!hasFiles(e)) return
	dragDepth = Math.max(0, dragDepth - 1)
	if (!dragDepth) dropOverlay.classList.remove('show')
})
window.addEventListener('drop', e => {
	if (!hasFiles(e)) return
	e.preventDefault()
	dragDepth = 0
	dropOverlay.classList.remove('show')
	handleFiles(e.dataTransfer.files)
})

// Pegar una imagen con Ctrl+V
window.addEventListener('paste', e => {
	const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'))
	if (files.length) {
		e.preventDefault()
		handleFiles(files)
	}
})

el.taskForm.addEventListener('submit', e => {
	e.preventDefault()
	const text = el.taskInput.value.trim()
	if (!text) return
	tasks.push({ text, done: false, current: !tasks.some(t => t.current && !t.done) })
	el.taskInput.value = ''
	saveTasks()
})

el.play.addEventListener('click', () => {
	sounds.click()
	isRunning() ? pause() : start()
})
el.reset.addEventListener('click', () => {
	sounds.click()
	reset()
})
el.skip.addEventListener('click', skip)

document.querySelectorAll('.mode').forEach(b =>
	b.addEventListener('click', () => {
		if (b.dataset.mode === mode) return
		sounds.click()
		setMode(b.dataset.mode)
	})
)

el.themeBtn.addEventListener('click', () => {
	settings.theme = settings.theme === 'theme-dark' ? 'theme-light' : 'theme-dark'
	saveSettings()
	applyTheme()
})

document.addEventListener('keydown', e => {
	if (e.code !== 'Space') return
	const tag = document.activeElement?.tagName
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
	e.preventDefault()
	isRunning() ? pause() : start()
})

// ---------- Inicio ----------
applyTheme()
markPreset()
showQuote()
el.quote.addEventListener('click', showQuote)
renderSounds()
renderTasks()
renderLog()
renderHeader()
renderGallery()
loadBackground()
