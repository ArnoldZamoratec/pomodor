// Cuenta y sincronización con Firebase (Auth + Firestore).
// El SDK se carga desde la CDN de Google solo cuando hace falta, así el temporizador
// sigue funcionando aunque no haya internet.

const FIREBASE_VERSION = '10.12.2'
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`

// La apiKey de Firebase no es secreta: identifica el proyecto. Lo que protege
// los datos son las reglas de Firestore (ver firestore.rules).
const firebaseConfig = {
	apiKey: 'AIzaSyDl9867Cxty4b6WLuGfIn-CuqDTk-oVpk0',
	authDomain: 'focus-pomodoro-a9f4b.firebaseapp.com',
	projectId: 'focus-pomodoro-a9f4b',
	storageBucket: 'focus-pomodoro-a9f4b.firebasestorage.app',
	messagingSenderId: '25292617071',
	appId: '1:25292617071:web:00ec30f4ef3d54766fe49a',
	measurementId: 'G-852PFCXRY0'
}

// Datos que se guardan en la cuenta (claves de localStorage con prefijo ft:)
export const SYNC_KEYS = ['history', 'tasks', 'settings', 'volumes']

let fb = null // { auth, db, A (auth fns), F (firestore fns) }

export async function loadFirebase() {
	if (fb) return fb
	const [{ initializeApp }, A, F] = await Promise.all([
		import(`${CDN}/firebase-app.js`),
		import(`${CDN}/firebase-auth.js`),
		import(`${CDN}/firebase-firestore.js`)
	])
	const app = initializeApp(firebaseConfig)
	const auth = A.getAuth(app)
	A.useDeviceLanguage(auth)
	const db = F.getFirestore(app)
	fb = { auth, db, A, F }

	// Analytics (opcional; si el navegador lo bloquea, no pasa nada)
	import(`${CDN}/firebase-analytics.js`)
		.then(async an => ((await an.isSupported()) ? an.getAnalytics(app) : null))
		.catch(() => {})

	return fb
}

export function onUser(cb) {
	fb.A.onAuthStateChanged(fb.auth, cb)
}

export async function register(name, email, password) {
	const cred = await fb.A.createUserWithEmailAndPassword(fb.auth, email, password)
	if (name) await fb.A.updateProfile(cred.user, { displayName: name })
	fb.A.sendEmailVerification(cred.user).catch(() => {})
	return cred.user
}

export function login(email, password) {
	return fb.A.signInWithEmailAndPassword(fb.auth, email, password)
}

export async function loginWithGoogle() {
	const provider = new fb.A.GoogleAuthProvider()
	try {
		return await fb.A.signInWithPopup(fb.auth, provider)
	} catch (e) {
		// En apps instaladas o celulares a veces se bloquea la ventana: se usa redirección
		if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
			return fb.A.signInWithRedirect(fb.auth, provider)
		}
		throw e
	}
}

export function resetPassword(email) {
	return fb.A.sendPasswordResetEmail(fb.auth, email)
}

export function logout() {
	return fb.A.signOut(fb.auth)
}

const userDoc = uid => fb.F.doc(fb.db, 'users', uid)

export async function pull(uid) {
	const snap = await fb.F.getDoc(userDoc(uid))
	return snap.exists() ? snap.data() : null
}

export function push(uid, data) {
	// merge: true une los mapas (cada día del historial por separado)
	return fb.F.setDoc(userDoc(uid), { ...data, updatedAt: fb.F.serverTimestamp() }, { merge: true })
}

// Mensajes de error en español
export function errorMessage(e) {
	const map = {
		'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
		'auth/invalid-email': 'Ese correo no es válido.',
		'auth/missing-email': 'Escribe tu correo.',
		'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
		'auth/missing-password': 'Escribe tu contraseña.',
		'auth/invalid-credential': 'Correo o contraseña incorrectos.',
		'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
		'auth/wrong-password': 'Correo o contraseña incorrectos.',
		'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
		'auth/user-disabled': 'Esta cuenta está desactivada.',
		'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
		'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
		'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
		'auth/cancelled-popup-request': 'Se canceló el inicio con Google.',
		'auth/unauthorized-domain': 'Este sitio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
		'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase (Authentication → Método de acceso).',
		'auth/configuration-not-found': 'Falta activar Authentication en la consola de Firebase.',
		'permission-denied': 'Firebase rechazó guardar tus datos: revisa las reglas de Firestore.'
	}
	return map[e?.code] || 'Algo salió mal. Inténtalo otra vez.'
}
