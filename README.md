# ¿Quién lava los platos?

Primera versión de una app web para gestionar turnos de lavado de platos con:

- turnos por franja del día
- registro rápido de acciones
- rachas y recompensas
- historial visual
- animaciones suaves y diseño minimalista

## Ejecutar localmente

1. Instala dependencias:
   - `npm install`
2. Inicia el servidor:
   - `npm start`
3. Abre en el navegador:
   - `http://localhost:3000`

## Soporte offline y sincronización

- La app funciona offline porque guarda el estado localmente en el navegador.
- Las acciones se agregan a una cola de sincronización y se envían a `/sync` cuando vuelve la conexión.
- Necesitas ejecutar `npm start` en un servidor real para que el teléfono pueda conectarse desde otra red.

## Instalar como app móvil

1. Abre la app en un navegador moderno (Chrome, Edge, Brave o Firefox) desde `http://localhost` o `https`.
2. El navegador debe detectar el `manifest.webmanifest` y el `service worker`.
3. Usa la opción del navegador para "Agregar a la pantalla de inicio" o "Instalar".
4. La app funcionará en modo independiente y podrá usarse sin conexión después de la primera visita.

> Nota: el `service worker` solo se registra en `https` o `localhost`.
