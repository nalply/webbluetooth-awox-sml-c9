window.store = { hue: 0 }
window.addEventListener('load', async function() {
  onclick('#connection', connection)
  onclick('#on', ev => c9Command('on'))
  onclick('#off', ev => c9Command('off'))
  onchange('#lightness', ev => paintColorsWheel(ev.target.value))
  onmousemove('#panel', ev => mouseoverPanel(ev.offsetX, ev.offsetY))
  onclick('#panel', ev => clickPanel(ev.offsetX, ev.offsetY))
  onchange('#command', ev => {
    const command = localStorage.commandSelectedOption = ev.target.value
    showParams(command)
  })
  onclick('.go', ev => go(ev.target))

  elem('#colorsUI', el => {
    const style = getComputedStyle(el)
    el.width = 200
    el.height = 200
    store.ctx = el.getContext('2d')
  })

  if (!localStorage.commandSelectedOption)
    localStorage.commandSelectedOption = 'rgb'
  updateView()
  elem('#panel', el => el.dataset.show = true)
})


async function connection() {
  if (store.gatt) {
    bluetoothDisconnect()
    delete store.gatt
    delete store.light
  }
  else {
    await bluetoothConnect()
  }
  updateView()
}


async function go(el) {
  const command = elem('#command')[0].value
  switch (command) {
    case 'brightness': {
      const paramBrightness = +elem('#param_brightness')[0].value
      await c9Command('brightness', paramBrightness)
    }; break
    case 'rgb': {
      const paramRGB = getRGB(elem('#param_rgb')[0].value)
      await c9Command('rgb', ...paramRGB)
    }; break
    default: console.error('Unknown command', command)
  }
}


function elem(sel, f) {
  if ('function' != typeof f) f = _ => _
  return Array.from(document.querySelectorAll(sel)).map(f)
}


function onclick(sel, f) {
  if ('function' != typeof f) f = ev => console.debug(ev)
  return elem(sel, el => el.addEventListener('click', f))
}


function onchange(sel, f) {
  if ('function' != typeof f) f = ev => console.debug(ev)
  return elem(sel, el => el.addEventListener('change', f))
}


function onmousemove(sel, f) {
  if ('function' != typeof f) f = ev => console.debug(ev)
  return elem(sel, el => el.addEventListener('mousemove', f))  
}


function updateView() {
  const connected = !!store.gatt
  elem('#panel', el => el.dataset.show = connected)
  elem('#connection', el => el.innerText = connected ? 'disconnect' : 'connect')
  paintColorsWheel(elem('#lightness')[0].value)
  elem('#command', el => el.value = localStorage.commandSelectedOption)
  showParams(localStorage.commandSelectedOption)
}


function showParams(command) {
  elem('.params', el => el.dataset.show = false)
  elem('#cmd_' + command, el => el.dataset.show = true)
}


function paintColorsWheel(lightness) {
  const d2r = Math.PI / 180
  const d = 5
  const ctx = store.ctx

  ctx.lineWidth = 50
  for (let i = 0; i < 360; i += d) {
    ctx.strokeStyle = hsl(i, lightness)
    ctx.beginPath()
    ctx.arc(100, 100, 70, i * d2r , (i + d + 0.5) * d2r)
    ctx.stroke()
  }
}


function paintCentralColor(hue, lightness) {
  const ctx = store.ctx
  ctx.fillStyle = hsl(hue, lightness)
  ctx.fillRect(75, 75, 50, 50)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'grey'
  ctx.strokeRect(74, 74, 52, 52)
}


function hsl(hue, lightness) {
  return `hsl(${hue},100%,${lightness}%)`
}

function mouseoverPanel(x, y) {
  const hue = getHue(x, y)
  if (isNaN(hue)) return

  store.hue = hue
  paintCentralColor(hue, elem('#lightness')[0].value)
}


function clickPanel(x, y) {
  const hue = getHue(x, y)
  if (isNaN(hue)) return

  store.hue = hue
  const lightness = elem('#lightness')[0].value
  paintCentralColor(hue, elem)

  c9Command('rgb', ...getRGB(hsl(hue, lightness)))
}


function getHue(x, y) {
  x -= 100
  y -= 100
  const r = Math.sqrt(x * x + y * y)
  if (r < 40 || r > 90) return NaN

  const theta = Math.atan2(y, x)
  return 180 * theta / Math.PI
}


function getRGB(cssColor) {
  const colorConverterElement = elem('#cconv')[0]
  colorConverterElement.style.color = cssColor
  return getComputedStyle(colorConverterElement).color
    .match(/^rgb\((\d+), *(\d+), *(\d+)\)$/)
    .slice(1).map(x => +x)
}




// --- Web Bluetooth functions ---

async function bluetoothConnect() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ name: '' }, { namePrefix: 'SML' }],
    optionalServices: [ 0x180a, 0xfff0 ]
  })
  store.gatt = await device.gatt.connect()
  const service = await store.gatt.getPrimaryService(0xfff0)
  store.light = await service.getCharacteristic(0xfff1)
  if (!store.light) throw new Error('characteristic not ready')
}


async function bluetoothDisconnect() {
  store.gatt.disconnect()
}


async function c9Command(what, ...args) {
  const headBytes = [0xAA, 0x0A, 0xFC, 0x3A, 0x86, 0x01]
  const onBytes = [0x0A, 0x01, 0x01, 0x00, 0x28]
  const offBytes = [0x0A, 0x01, 0x00, 0x01, 0x28]
  const brightnessBytes = [0x0C, 0x01]
  const rgb1Bytes = [0x0D, 0x06]
  const rgb2Bytes = [0x20, 0x30]
  const lastByte = 0x0d

  switch (what) {
    case 'on': await send(onCode()); break
    case 'off': await send(offCode()); break
    case 'rgb': await send(rgbCode(...args)); break
    case 'brightness': await send(brightnessCode(...args)); break
    default: console.error('Unknown command', what)
  }

  async function send(code) {
    console.debug('sending', codeToString(code))
    await store.light.writeValue(new Uint8Array(code))
    console.debug('sent!')
  }

  function onCode() { return [...headBytes, ...onBytes, lastByte] }

  function offCode() { return [...headBytes, ...offBytes, lastByte] }
  
  function rgbCode(r, g, b, slow) {
    console.log(`rgb(${r},${g},${b})`)
    const code = [
      ...headBytes, ...rgb1Bytes,
      toByte(slow), toByte(r), toByte(g), toByte(b), 
      ...rgb2Bytes, 137,
    ]
    code.push(checksum(code))
    code.push(lastByte)
    return code
  }

  function brightnessCode(brightness) {
    const code = [
      ...headBytes, ...brightnessBytes, toByte(9 * brightness + 2),
    ]
    code.push(checksum(code))
    code.push(lastByte)
    return code
  }

  // see dragouf/aws-smartlight lib.js:129 https://goo.gl/mxMRxu
  function checksum(code) {
    return (code.slice(1).reduce((a, b) => a + b) + 85) & 0xFF
  }

  function codeToString(code) {
    return code.map(_ => _.toString(16).padStart(2, '0')).join(' ')
  }

  function toByte(x) {
    x = x | 0
    return x < 0 ? 0 : x > 255 ? 255 : x
  }
}

// 0x2a24 SML-c9
// 0x2a26 1.0
// 0x2a27 1.0
// 0x2a28 1.0.0
// 0x2a29 AwoX
// 0xfff1 write bytes and read one byte
// 0xfff2 read one byte
// 0xfff3 write bytes
// 0xfff4 subscribe
// 0xfff5 pair

