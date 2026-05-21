/**
 * Input — Teclado + Gamepad unificados
 * Lê ambos e expõe { left, right, up, down, buttonA, buttonB, buttonX, start }
 *
 * Compatível com painéis arcade / flipper mapeados como "XBOX 360 For Windows".
 */

const state = {
  left: false,
  right: false,
  up: false,
  down: false,
  buttonA: false,
  buttonB: false,
  buttonX: false,
  start: false,
};

/** Zona morta menor — bastões arcade costumam ser quase digitais (-1 / 0 / +1). */
const AXIS_DEADZONE = 0.32;

let activeGamepadIndex = null;
let gamepadLabel = '';
let gamepadReady = false;

const keysDown = {};

document.addEventListener('keydown', (e) => {
  keysDown[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  keysDown[e.code] = false;
});

function onGamepadConnected(e) {
  activeGamepadIndex = e.gamepad.index;
  gamepadLabel = e.gamepad.id || 'Gamepad';
  gamepadReady = true;
  console.log('[Input] Gamepad conectado:', gamepadLabel);
  const dbg = document.getElementById('debug-info');
  if (dbg) dbg.textContent = 'Gamepad: ' + gamepadLabel;
}

function onGamepadDisconnected(e) {
  if (activeGamepadIndex === e.gamepad.index) {
    activeGamepadIndex = null;
    gamepadLabel = '';
    gamepadReady = false;
    console.log('[Input] Gamepad desconectado');
  }
}

window.addEventListener('gamepadconnected', onGamepadConnected);
window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

/** Primeiro clique na página “acorda” o gamepad em alguns browsers. */
document.addEventListener(
  'pointerdown',
  () => {
    scanGamepads();
  },
  { once: true, capture: true }
);

function scanGamepads() {
  const pads = navigator.getGamepads?.();
  if (!pads) return null;
  for (const gp of pads) {
    if (gp?.connected) {
      activeGamepadIndex = gp.index;
      gamepadLabel = gp.id || 'Gamepad';
      gamepadReady = true;
      return gp;
    }
  }
  return null;
}

function getActiveGamepad() {
  const pads = navigator.getGamepads?.();
  if (!pads) return null;
  if (activeGamepadIndex != null && pads[activeGamepadIndex]?.connected) {
    return pads[activeGamepadIndex];
  }
  return scanGamepads();
}

function axisDir(value) {
  if (value < -AXIS_DEADZONE) return -1;
  if (value > AXIS_DEADZONE) return 1;
  return 0;
}

function btnPressed(buttons, index) {
  const b = buttons[index];
  if (!b) return false;
  if (typeof b === 'object' && 'pressed' in b) return !!b.pressed;
  return !!b;
}

function readGamepad() {
  const gp = getActiveGamepad();
  if (!gp) return;

  const ax0 = gp.axes[0] ?? 0;
  const ax1 = gp.axes[1] ?? 0;
  const h = axisDir(ax0);
  const v = axisDir(ax1);

  state.left = h < 0;
  state.right = h > 0;
  state.up = v < 0;
  state.down = v > 0;

  const b = gp.buttons;

  // D-pad (Chrome / XInput): 12 cima, 13 baixo, 14 esquerda, 15 direita
  if (btnPressed(b, 12)) state.up = true;
  if (btnPressed(b, 13)) state.down = true;
  if (btnPressed(b, 14)) state.left = true;
  if (btnPressed(b, 15)) state.right = true;

  // Hat em alguns encoders USB (eixos 6 e 7)
  if (gp.axes.length >= 8) {
    const hatX = gp.axes[6];
    const hatY = gp.axes[7];
    if (hatX < -0.5) state.left = true;
    if (hatX > 0.5) state.right = true;
    if (hatY < -0.5) state.up = true;
    if (hatY > 0.5) state.down = true;
  }

  // Botões arcade / Xbox: A=0 B=1 X=2 Y=3, LB=4 RB=5, Back=6 Start=7
  const b0 = btnPressed(b, 0);
  const b1 = btnPressed(b, 1);
  const b2 = btnPressed(b, 2);
  const b3 = btnPressed(b, 3);
  const b4 = btnPressed(b, 4);
  const b5 = btnPressed(b, 5);
  const b6 = btnPressed(b, 6);
  const b7 = btnPressed(b, 7);

  // Ação principal (pulo / atirar / confirmar)
  state.buttonA = b0 || b2 || b4;
  // Soco / boost / secundário (painéis com 1–2 botões grandes)
  state.buttonB = b1 || b3 || b5 || b0;
  state.buttonX = b2 || b3;
  state.start = b7 || b6 || btnPressed(b, 8) || btnPressed(b, 9);
}

function readKeyboard() {
  const gpL = state.left;
  const gpR = state.right;
  const kL =
    !!keysDown['ArrowLeft'] ||
    !!keysDown['KeyA'] ||
    !!keysDown['Numpad4'] ||
    !!keysDown['KeyJ'];
  const kR =
    !!keysDown['ArrowRight'] ||
    !!keysDown['KeyD'] ||
    !!keysDown['Numpad6'] ||
    !!keysDown['KeyL'];
  state.left = kL || (gpL && !kR);
  state.right = kR || (gpR && !kL);
  if (state.left && state.right) {
    state.left = false;
    state.right = true;
  }
  if (keysDown['ArrowUp']) state.up = true;
  if (keysDown['ArrowDown']) state.down = true;
  if (keysDown['Space']) state.buttonA = true;
  if (keysDown['KeyX']) state.buttonX = true;
  if (keysDown['KeyC'] || keysDown['ShiftLeft'] || keysDown['KeyZ']) state.buttonB = true;
  if (keysDown['Enter']) state.start = true;
}

export function poll() {
  state.left = false;
  state.right = false;
  state.up = false;
  state.down = false;
  state.buttonA = false;
  state.buttonB = false;
  state.buttonX = false;
  state.start = false;

  try {
    readGamepad();
  } catch (err) {
    console.warn('[Input] Falha ao ler gamepad:', err);
  }
  readKeyboard();

  return state;
}

export function getState() {
  return state;
}

/** Status do gamepad para debug / HUD opcional. */
export function getGamepadInfo() {
  return {
    ready: gamepadReady,
    label: gamepadLabel,
    index: activeGamepadIndex,
  };
}
