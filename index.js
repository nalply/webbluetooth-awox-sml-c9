function elem(sel, f) {
  if ('function' != typeof f) f = _ => _
  return Array.from(document.querySelectorAll(sel)).map(f)
}

function onclick(sel, f) {
  if ('function' != typeof f) f = ev => console.debug(ev)
  return elem(sel, el => el.addEventListener('click', f))
}

window.addEventListener('load', async function() {
  onclick('#connect', connect)
  onclick('#on', onCommand)
  onclick('#off', offCommand)
})



const id1 = "e8fG9L71Pb//gZWXmEekCw=="
const id2 = "7hnPk0z3lID8lLPxdYRVww=="

async function connect() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ name: '' }, { namePrefix: 'SML' }],
    optionalServices: [ 0x180a, 0xfff0 ]
  })
  console.log('id', device.id)
  const gatt = await device.gatt.connect()
  const lightService = await gatt.getPrimaryService(0xfff0)
  const light = await lightService.getCharacteristic(0xfff1)

  window.light = light
}


const head = [0xAA, 0x0A, 0xFC, 0x3A, 0x86, 0x01]
const tail = [0x0D]
const on = [0x0A, 0x01, 0x01, 0x00, 0x28]
const off = [0x0A, 0x01, 0x00, 0x01, 0x28]


async function onCommand() {
  const buffer = new Uint8Array([...head, ...on, 0x0d])
  await light.writeValue(buffer)
}


async function offCommand() {
  const buffer = new Uint8Array([...head, ...off, 0x0d])
  await light.writeValue(buffer)
}




// 0x2a24 SML-c9
// 0x2a26 1.0
// 0x2a27 1.0
// 0x2a28 1.0.0
// 0x2a29 AwoX
// 0xfff1 1 byte lesen und schreiben 0x00
// 0xfff2 1 byte lesen 0x02
// 0xfff3 bytes schreiben
// 0xfff4 subscribe
// 0xfff5 pair

