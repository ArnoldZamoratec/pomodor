# Focus Timer · Pomodoro

Temporizador pomodoro con fondo según tu tema, sonidos ambientales y frases motivacionales.

## Funciones

- **Pomodoro completo**: enfoque, descanso y descanso largo con rondas configurables (presets 25/5, 50/10, 90/15). Pasa solo al siguiente bloque, suena una campana y avisa con notificación.
- **¿Qué vas a hacer?**: escribe tu tema y aparece en grande sobre el reloj. Lista de tareas con "tarea actual".
- **Fondo según tu tema**: busca fotos de Wikimedia Commons (estudiar → biblioteca, programar → ciudad de noche…), o usa una URL.
- **Sube tus imágenes**: botón, arrastrar y soltar o Ctrl+V. Se guardan en el navegador (IndexedDB).
- **11 sonidos mezclables**: lluvia, bosque, fogata, cafetería, olas, viento, ventilador, reloj tic-tac y ruido blanco, rosa y marrón (los últimos se generan con Web Audio API).
- **Frases** que rotan según el modo (enfoque, descanso, descanso largo).
- Historial del día, tema claro/oscuro y atajo de teclado (Espacio para iniciar/pausar).

## Cómo ejecutarlo

Usa módulos ES, así que necesita un servidor local (no funciona abriendo el archivo directamente):

```bash
python -m http.server 8080
```

Luego abre <http://localhost:8080>.

## Créditos

- Basado en [focus-timer](https://github.com/LucasSPaiva/focus-timer) de LucasSPaiva.
- Fotos de los sonidos: Wikimedia Commons, ver [`img/sounds/CREDITOS.md`](img/sounds/CREDITOS.md).
