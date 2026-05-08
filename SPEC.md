# Palabrea - Juego de Palabras por Turnos

## Descripción del Juego
- Dos jugadores se unen a una sala mediante un código
- El sistema genera una palabra aleatoria en español
- Ambos jugadores se turnan para responder con una palabra que empiece exactamente por las dos primeras letras de la palabra de referencia
- Las palabras no pueden repetirse durante la partida
- Si un jugador se rinde, pierde
- No hay límite de tiempo por turno

## Stack Tecnológico
- Frontend: React + Vite
- Estilos: Tailwind CSS (CDN, sin compilación)
- Base de datos + Realtime: Supabase (plan gratuito)
- Hosting: GitHub Pages
- Routing: React Router v6 con HashRouter
- Estado global: React Context + useReducer

## Esquema de Base de Datos

### Tabla rooms
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- code: text UNIQUE NOT NULL (código de 6 letras mayúsculas)
- status: text NOT NULL DEFAULT 'waiting' ('waiting' | 'playing' | 'finished')
- player1_name: text NOT NULL
- player2_name: text
- current_turn: text (nombre del jugador con el turno activo)
- current_word: text (palabra de referencia actual)
- winner: text (nombre del ganador al finalizar)
- score_p1: int DEFAULT 0
- score_p2: int DEFAULT 0
- created_at: timestamptz DEFAULT now()

### Tabla moves
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- room_id: uuid REFERENCES rooms(id) ON DELETE CASCADE
- player: text NOT NULL
- word: text NOT NULL
- created_at: timestamptz DEFAULT now()

### Tabla player_sessions
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- player_name: text NOT NULL
- room_id: uuid REFERENCES rooms(id) ON DELETE CASCADE
- room_code: text NOT NULL
- player_slot: text NOT NULL ('player1' | 'player2')
- created_at: timestamptz DEFAULT now()

## Persistencia de Sesión Local
Guardar en localStorage:
```json
{
  "playerName": "Ana",
  "roomCode": "XKTP92",
  "playerSlot": "player1"
}
```

## Estructura de Carpetas
```
src/
├── components/
│   ├── ChatBubble.jsx
│   └── ActiveRoomsBanner.jsx
├── pages/
│   ├── Home.jsx
│   ├── Game.jsx
│   └── GameOver.jsx
├── context/
│   └── GameContext.jsx
├── lib/
│   ├── supabase.js
│   └── words.js
├── App.jsx
└── main.jsx
```

## Página 1: Home (/)

### Funcionalidades:
1. **Leer localStorage** para obtener sesiones guardadas
2. **Consultar salas activas**: cruce entre player_sessions y rooms donde playerName tiene sesión activa y status sea 'waiting' o 'playing'
3. **Mostrar banner "Tus partidas activas"** con tarjetas que muestren:
   - Código de sala
   - Nombre del rival (si ya se unió)
   - Estado (Esperando rival / En curso - Turno de X)
   - Botón "Reconectarse"

### Flujo Crear Sala:
1. Usuario escribe su nombre (mínimo 2 caracteres)
2. Pulsa "Crear sala"
3. Generar código aleatorio de 6 caracteres mayúsculas
4. Insertar en rooms: { code, status: 'waiting', player1_name: nombre }
5. Insertar en player_sessions: { player_name: nombre, room_id, room_code: code, player_slot: 'player1' }
6. Guardar en localStorage
7. Mostrar código con botón "Copiar código" y spinner "Esperando a que se una un jugador…"
8. Suscribirse a realtime de esa sala. Когда status cambia a 'playing' → navegar a /game/:roomCode?player=player1

### Flujo Unirse a Sala:
1. Usuario escribe nombre y código de sala
2. Pulsa "Unirse"
3. Buscar rooms donde code = código y status = 'waiting'
4. Si no existe → error "Sala no encontrada o ya en curso"
5. Si existe → actualizar rooms: { player2_name: nombre, status: 'playing', current_turn: player1_name, current_word: palabra aleatoria }
6. Insertar en player_sessions
7. Guardar en localStorage
8. Navegar a /game/:roomCode?player=player2

## Página 2: Game (/game/:roomCode)

### Parámetros:
- roomCode en la ruta
- player (player1 | player2) en query string

### Al montar:
1. Cargar sala desde Supabase
2. Si status = 'finished' → redirigir a /gameover/:roomCode?player=...
3. Si la sala no existe → redirigir a / con error
4. Cargar todos los moves ordenados por created_at ASC
5. Suscribirse a realtime de rooms y moves

### Layout:
- Barra superior: "👤 Turno de: [nombre]"
- Sección palabra de referencia: [PA]labra (primeras 2 letras en negrita)
- Chat con burbujas (estilo WhatsApp, scroll automático)
- Input para palabra + botón enviar
- Botón "Rendirse"

### Validación (cliente):
1. La palabra debe empezar por las mismas dos primeras letras que current_word (case-insensitive, ignorar tildes)
2. La palabra no puede estar ya en los moves
3. Mínimo 3 caracteres
4. Error en rojo debajo del input

### Lógica de envío:
1. Insertar en moves: { room_id, player: nombre, word }
2. Actualizar rooms: current_turn = otro jugador
3. Limpiar input y hacer scroll al fondo

### Realtime:
- Nuevo move → añadir burbuja y scroll
- rooms.status = 'finished' → navegar a /gameover

### ChatBubble:
- Mis palabras: derecha, fondo verde oscuro
- palabras del rival: izquierda, gris oscuro
- Mostrar nombre encima
- Mostrar hora (HH:MM) debajo

### Botón Rendirse:
- confirm() nativo: "¿Seguro que quieres rendirte?"
- Si confirma → rooms: { status: 'finished', winner: otroJugador }

## Página 3: GameOver (/gameover/:roomCode)

### Al montar:
1. Cargar sala desde Supabase
2. Solo el ganador ejecuta update de score (evitar doble escritura)

### UI:
- Si ganaste: 🏆 "¡Has ganado, [nombre]!"
- Si perdiste: "Has Mejor suerte la próxima vez!"
- Marcador: [player1]: X — [player2]: Y
- Botón "Volver a jugar": navega a /
- Botón "Salir": limpia localStorage y navega a /

## Casos Edge
1. Acceso a /game/:roomCode con status = 'finished' → redirigir a /gameover
2. Acceso a sala inexistente → redirigir a / con error
3. Reconexión desde Home via banner
4. Si el creador espera más de 5 minutos → mostrar botón "Cancelar sala"
5. Input deshabilitado cuando no es tu turno
6. Si dos jugadores intentan unirse a la vez → el segundo recibe error

## Deploy en GitHub Pages
- vite.config.js: base: '/<nombre-del-repo>/'
- Usar HashRouter
- Script: "deploy": "vite build && gh-pages -d dist"