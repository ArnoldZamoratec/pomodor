// Motor de sonido: audios en archivo + sonidos generados con Web Audio API

let ctx = null

function getCtx() {
	if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
	if (ctx.state === 'suspended') ctx.resume()
	return ctx
}

const bufferCache = {}

function noiseBuffer(type, seconds = 8) {
	if (bufferCache[type]) return bufferCache[type]
	const ac = getCtx()
	const len = ac.sampleRate * seconds
	const buf = ac.createBuffer(2, len, ac.sampleRate)
	for (let ch = 0; ch < 2; ch++) {
		const d = buf.getChannelData(ch)
		let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
		for (let i = 0; i < len; i++) {
			const w = Math.random() * 2 - 1
			if (type === 'white') {
				d[i] = w * 0.5
			} else if (type === 'pink') {
				b0 = 0.99886 * b0 + w * 0.0555179
				b1 = 0.99332 * b1 + w * 0.0750759
				b2 = 0.969 * b2 + w * 0.153852
				b3 = 0.8665 * b3 + w * 0.3104856
				b4 = 0.55 * b4 + w * 0.5329522
				b5 = -0.7616 * b5 - w * 0.016898
				d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
				b6 = w * 0.115926
			} else {
				last = (last + 0.02 * w) / 1.02
				d[i] = last * 3.5
			}
		}
		// Suaviza el punto de bucle para evitar clics
		const fade = Math.floor(ac.sampleRate * 0.05)
		for (let i = 0; i < fade; i++) {
			const t = i / fade
			d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t
		}
	}
	bufferCache[type] = buf
	return buf
}

function noiseSource(type) {
	const src = getCtx().createBufferSource()
	src.buffer = noiseBuffer(type)
	src.loop = true
	return src
}

function lfo(freq, amount, target) {
	const ac = getCtx()
	const osc = ac.createOscillator()
	const g = ac.createGain()
	osc.frequency.value = freq
	g.gain.value = amount
	osc.connect(g).connect(target)
	osc.start()
	return osc
}

// Cada generador devuelve una lista de nodos a detener y conecta su salida a `out`
const generators = {
	white(out) {
		const s = noiseSource('white')
		const g = getCtx().createGain()
		g.gain.value = 0.35
		s.connect(g).connect(out)
		s.start()
		return [s]
	},
	pink(out) {
		const s = noiseSource('pink')
		s.connect(out)
		s.start()
		return [s]
	},
	brown(out) {
		const s = noiseSource('brown')
		s.connect(out)
		s.start()
		return [s]
	},
	waves(out) {
		const ac = getCtx()
		const s = noiseSource('brown')
		const lp = ac.createBiquadFilter()
		lp.type = 'lowpass'
		lp.frequency.value = 700
		const amp = ac.createGain()
		amp.gain.value = 0.55
		const foam = noiseSource('white')
		const hp = ac.createBiquadFilter()
		hp.type = 'highpass'
		hp.frequency.value = 2500
		const foamAmp = ac.createGain()
		foamAmp.gain.value = 0.04
		s.connect(lp).connect(amp).connect(out)
		foam.connect(hp).connect(foamAmp).connect(out)
		const l1 = lfo(0.09, 0.45, amp.gain)
		const l2 = lfo(0.09, 0.04, foamAmp.gain)
		const l3 = lfo(0.09, 350, lp.frequency)
		s.start()
		foam.start()
		return [s, foam, l1, l2, l3]
	},
	wind(out) {
		const ac = getCtx()
		const s = noiseSource('pink')
		const bp = ac.createBiquadFilter()
		bp.type = 'bandpass'
		bp.frequency.value = 500
		bp.Q.value = 0.9
		const amp = ac.createGain()
		amp.gain.value = 1.4
		s.connect(bp).connect(amp).connect(out)
		const l1 = lfo(0.06, 280, bp.frequency)
		const l2 = lfo(0.13, 0.6, amp.gain)
		s.start()
		return [s, l1, l2]
	},
	fan(out) {
		const ac = getCtx()
		const s = noiseSource('brown')
		const lp = ac.createBiquadFilter()
		lp.type = 'lowpass'
		lp.frequency.value = 420
		const hum = ac.createOscillator()
		hum.frequency.value = 58
		const humG = ac.createGain()
		humG.gain.value = 0.03
		s.connect(lp).connect(out)
		hum.connect(humG).connect(out)
		s.start()
		hum.start()
		return [s, hum]
	},
	clock(out) {
		const ac = getCtx()
		const len = ac.sampleRate * 2
		const buf = ac.createBuffer(1, len, ac.sampleRate)
		const d = buf.getChannelData(0)
		const click = (start, freq) => {
			const n = Math.floor(ac.sampleRate * 0.03)
			for (let i = 0; i < n; i++) {
				const t = i / ac.sampleRate
				d[start + i] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 180) * 0.6
			}
		}
		click(0, 2100)
		click(ac.sampleRate, 1600)
		const s = ac.createBufferSource()
		s.buffer = buf
		s.loop = true
		s.connect(out)
		s.start()
		return [s]
	}
}

export const SOUND_LIST = [
	{ id: 'rain', name: 'Lluvia', file: 'audio/rain.mp3' },
	{ id: 'forest', name: 'Bosque', file: 'audio/forest.mp3' },
	{ id: 'fire', name: 'Fogata', file: 'audio/fire.mp3' },
	{ id: 'coffee', name: 'Cafetería', file: 'audio/coffee.mp3' },
	{ id: 'waves', name: 'Olas del mar', gen: 'waves' },
	{ id: 'wind', name: 'Viento', gen: 'wind' },
	{ id: 'fan', name: 'Ventilador', gen: 'fan' },
	{ id: 'clock', name: 'Reloj tic-tac', gen: 'clock' },
	{ id: 'white', name: 'Ruido blanco', gen: 'white' },
	{ id: 'pink', name: 'Ruido rosa', gen: 'pink' },
	{ id: 'brown', name: 'Ruido marrón', gen: 'brown' }
]

export function SoundEngine() {
	const active = {} // id -> { stop(), setVolume(v), volume }
	let master = 1 // se baja en los descansos

	// Sube/baja el volumen de un <audio> poco a poco
	function fadeAudio(a, to, ms = 1200) {
		clearInterval(a._fade)
		const from = a.volume
		const steps = Math.max(1, Math.round(ms / 50))
		let i = 0
		a._fade = setInterval(() => {
			i++
			a.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)))
			if (i >= steps) clearInterval(a._fade)
		}, 50)
	}

	function start(sound, volume) {
		if (active[sound.id]) return
		if (sound.file) {
			const a = new Audio(sound.file)
			a.loop = true
			a.volume = 0
			a.play().catch(() => {})
			fadeAudio(a, volume * master, 600)
			active[sound.id] = {
				volume,
				stop: () => { clearInterval(a._fade); a.pause(); a.src = '' },
				setVolume: (v, ms = 0) => (ms ? fadeAudio(a, v, ms) : (clearInterval(a._fade), (a.volume = v)))
			}
		} else {
			const ac = getCtx()
			const out = ac.createGain()
			out.gain.value = 0
			out.connect(ac.destination)
			out.gain.linearRampToValueAtTime(volume * master, ac.currentTime + 0.6)
			const nodes = generators[sound.gen](out)
			active[sound.id] = {
				volume,
				stop: () => {
					out.gain.cancelScheduledValues(ac.currentTime)
					out.gain.setValueAtTime(out.gain.value, ac.currentTime)
					out.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3)
					setTimeout(() => {
						nodes.forEach(n => { try { n.stop() } catch {} })
						out.disconnect()
					}, 350)
				},
				setVolume: (v, ms = 0) => out.gain.setTargetAtTime(v, ac.currentTime, ms ? ms / 3000 : 0.05)
			}
		}
	}

	function stop(id) {
		if (!active[id]) return
		active[id].stop()
		delete active[id]
	}

	function setVolume(id, v) {
		if (!active[id]) return
		active[id].volume = v
		active[id].setVolume(v * master)
	}

	// Volumen general (1 = normal). Se aplica suave a todo lo que suena.
	function setMaster(m) {
		if (m === master) return
		master = m
		Object.values(active).forEach(s => s.setVolume(s.volume * master, 1500))
	}

	function isActive(id) {
		return Boolean(active[id])
	}

	function stopAll() {
		Object.keys(active).forEach(stop)
	}

	// Campanita al terminar un bloque
	function chime() {
		const ac = getCtx()
		const notes = [880, 1108.73, 1318.51, 1760]
		notes.forEach((f, i) => {
			const t = ac.currentTime + i * 0.18
			const o = ac.createOscillator()
			const g = ac.createGain()
			o.type = 'sine'
			o.frequency.value = f
			g.gain.setValueAtTime(0, t)
			g.gain.linearRampToValueAtTime(0.25, t + 0.02)
			g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
			o.connect(g).connect(ac.destination)
			o.start(t)
			o.stop(t + 1.7)
		})
	}

	function click() {
		const ac = getCtx()
		const o = ac.createOscillator()
		const g = ac.createGain()
		o.frequency.value = 600
		g.gain.setValueAtTime(0.12, ac.currentTime)
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.08)
		o.connect(g).connect(ac.destination)
		o.start()
		o.stop(ac.currentTime + 0.1)
	}

	// Aviso suave: dos notas graves y lentas, sin sobresaltar
	function softBell() {
		const ac = getCtx()
		;[523.25, 659.25].forEach((f, i) => {
			const t = ac.currentTime + i * 0.45
			const o = ac.createOscillator()
			const g = ac.createGain()
			o.type = 'sine'
			o.frequency.value = f
			g.gain.setValueAtTime(0, t)
			g.gain.linearRampToValueAtTime(0.09, t + 0.08)
			g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
			o.connect(g).connect(ac.destination)
			o.start(t)
			o.stop(t + 2.3)
		})
	}

	const activeCount = () => Object.keys(active).length

	return { start, stop, setVolume, setMaster, isActive, stopAll, chime, click, softBell, activeCount }
}
