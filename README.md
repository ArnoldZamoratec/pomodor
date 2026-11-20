# Focus Timer · Pomodoro

Temporizador pomodoro con fondo según tu tema, sonidos ambientales y frases motivacionales.

## Funciones

- **Pomodoro completo**: enfoque, descanso y descanso largo con rondas configurables (presets 25/5, 50/10, 90/15). Pasa solo al siguiente bloque, suena una campana y avisa con notificación.
- **¿Qué vas a hacer?**: escribe tu tema y aparece en grande sobre el reloj. Lista de tareas con "tarea actual".
- **Fondo según tu tema**: busca fotos de Wikimedia Commons (estudiar → biblioteca, programar → ciudad de noche…), o usa una URL.
- **Sube tus imágenes**: botón, arrastrar y soltar o Ctrl+V. Se guardan en el navegador (IndexedDB).
- **11 sonidos mezclables**: lluvia, bosque, fogata, cafetería, olas, viento, ventilador, reloj tic-tac y ruido blanco, rosa y marrón (los últimos se generan con Web Audio API).
- **Frases** que rotan según el modo (enfoque, descanso, descanso largo).
- **Modo enfoque**: al iniciar solo queda el reloj y tu tema; fondo atenuado, segundos discretos y controles que se desvanecen.
- **Tu progreso**: meta diaria, racha de días seguidos, gráfico de la semana y tiempo por tema (se guarda hasta un año).
- **¿Cómo te fue?**: al terminar cada pomodoro marcas cómo te fue y si terminaste la tarea actual.
- **Aviso suave** cuando falta 1 minuto y **sonidos más bajos** en los descansos (opcionales).
- **Cuenta obligatoria** (Firebase): registro con correo o Google; el progreso, las tareas y los ajustes se sincronizan entre dispositivos.
- **App instalable** (PWA): se puede añadir a la pantalla de inicio y funciona sin internet.
- Pantalla completa opcional.

## Atajos de teclado

| Tecla | Acción |
| --- | --- |
| Espacio | Iniciar / pausar |
| R | Reiniciar |
| S | Saltar bloque |
| M | Silenciar sonidos |
| F | Pantalla completa |
| Esc | Ver las secciones sin pausar |

## Cómo ejecutarlo

Usa módulos ES, así que necesita un servidor local (no funciona abriendo el archivo directamente):

```bash
python -m http.server 8080
```

Luego abre <http://localhost:8080>.

## Configurar Firebase

En la [consola de Firebase](https://console.firebase.google.com/) del proyecto `focus-pomodoro-a9f4b`:

1. **Authentication → Método de acceso**: activa *Correo electrónico/contraseña* y *Google*.
2. **Authentication → Configuración → Dominios autorizados**: agrega `arnoldzamoratec.github.io`.
3. **Firestore Database → Crear base de datos**, y en **Reglas** pega el contenido de [`firestore.rules`](firestore.rules) y publica.

## Créditos

- Basado en [focus-timer](https://github.com/LucasSPaiva/focus-timer) de LucasSPaiva.
- Fotos de los sonidos: Wikimedia Commons, ver [`img/sounds/CREDITOS.md`](img/sounds/CREDITOS.md).
