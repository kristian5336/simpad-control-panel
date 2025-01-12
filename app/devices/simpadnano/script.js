'use strict'

const HID = require('node-hid')
const os = require('os')
const path = require('path')
const electron = require('electron')

//取色器
const ColorPicker = require(`h5-color-picker`).ColorPicker

//按键键值关系表
const KeyData = require(`./keyboardData`).data

/**
 * @param {HTMLElement} node
 */
const addClassName = (node, str) => {
  if (node.className.split(' ').filter(s => s === str).length === 0) {
    node.className += ` ${str}`
  }
}

/**
 * @param {HTMLElement} node
 */
const removeClassName = (node, str) => {
  node.className = node.className
    .split(' ')
    .filter(s => s !== str)
    .join(' ')
}

/**
 * @param {HTMLElement} node
 */
const boolClassName = (node, str) => {
  if (node.className.split(' ').filter(s => s === str).length === 0) {
    addClassName(node, str)
  } else {
    removeClassName(node, str)
  }
}

let device
let deviceInfo
let devices

/**
 * @type {Document}
 */
let document
let getLang

let sendData, page4Fin, page4Init, jumpPage

/**
 * @type {number[][]}
 * 0: 置空
 * 1: 键值1
 * 2: 键值2
 * 3: 键值3
 * 4: 键值4
 * 5: 键值5
 * 6: LED0, R,G,B,亮度
 * 7: LED1, R,G,B,亮度
 * 8: 灯光模式
 * 9: 防抖设定
 * 10: 极速模式，IAP模式，夜灯设置
 * 11: 灯光速度
 */
const settingsSet = new Array(12).fill(0).map(() => new Array(8))

/**
 * @type {number[][]}
 */
var settingChanged
let autoGetDataTimer
let getDataFunction

const getSettings = (pointer, dev = device) =>
  new Promise(function doIt(r, e) {
    getDataFunction.fun = data => {
      settingsSet[data[4]] = [...data]
      clearTimeout(autoGetDataTimer)
      if (pointer === data[4]) r()
    }
    if (dev) {
      var dat = [0x00, 0x01, pointer, 0x00, 0x00, 0x00, 0x00, 0x00]
      sendData(dat).catch(err => clearTimeout(autoGetDataTimer))
    } else {
      e()
      return
    }
    autoGetDataTimer = setTimeout(() => doIt(r, e), 30)
  })

let settingsAlready = false

const getAllSettings = (dev = device) => {
  if (dev) {
    console.time('getAllSettingsIn')
    settingsAlready = false
    return getSettings(1, dev)
      .then(() => getSettings(2, dev))
      .then(() => getSettings(3, dev))
      .then(() => getSettings(4, dev))
      .then(() => getSettings(5, dev))
      .then(() => getSettings(6, dev))
      .then(() => getSettings(7, dev))
      .then(() => getSettings(8, dev))
      .then(() => getSettings(9, dev))
      .then(() => getSettings(10, dev))
      .then(() => getSettings(11, dev))
      .then(
        () =>
          new Promise(r => {
            console.timeEnd('getAllSettingsIn')
            clearTimeout(autoGetDataTimer)
            settingsAlready = true
            r()
          })
      )
  } else {
    return new Promise((r, e) => e())
  }
}
// 获取版本号信息
let nowVersion
const getVersion = (dev = device) =>
  new Promise(function doIt(r, e) {
    getDataFunction.fun = data => {
      document.getElementById('firmwareVersionNum').innerHTML = ''
      ;[...data]
        .slice(0, 4)
        .forEach(
          d =>
            (document.getElementById(
              'firmwareVersionNum'
            ).innerHTML += d.toString().padStart(2, '0'))
        )
      let versionGet = parseInt(
        document.getElementById('firmwareVersionNum').innerHTML,
        10
      )
      nowVersion = versionGet
      if (versionGet <= 20180926) {
        document.getElementById('jumpToBootMode').style.display = 'none'
      } else {
        document.getElementById('jumpToBootMode').removeAttribute('style')
      }
      clearTimeout(autoGetDataTimer)
      r()
    }
    if (dev) {
      var dat = [0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
      sendData(dat).catch(err => clearTimeout(autoGetDataTimer))
    } else {
      e()
      return
    }
    autoGetDataTimer = setTimeout(() => doIt(r, e), 30)
  })

const getChipID = (dev = device) => {
  return new Promise((resolve, error) => {
    /**
     * @param {[string]} data
     */
    getDataFunction.fun = data => {
      document.getElementById('chipIDNum').innerHTML = ''
      ;[...data].slice(0, 4).forEach(
        d =>
          (document.getElementById('chipIDNum').innerHTML += d
            .toString(16)
            .toUpperCase()
            .padStart(2, '0'))
      )
      clearTimeout(autoGetDataTimer)
      resolve()
    }
    if (dev) {
      var dat = [0x00, 0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]
      sendData(dat).catch(err => clearTimeout(autoGetDataTimer))
    } else {
      error()
      return
    }
    autoGetDataTimer = setTimeout(() => doIt(r, e), 30)
  })
}

const updateKeyCodeText = () => {
  //键值设置
  var keyNum = 5
  const keyInfoArr = [
    ...document.getElementById('btnSettingsList').getElementsByClassName('midP')
  ]
  keyInfoArr.forEach((nodeElement, index) => {
    nodeElement.innerHTML = ''
    const keyStrSet = []
    if (settingChanged[index + 1][0] > 0) {
      Object.values(KeyData).forEach(arr => {
        if (arr[0] === 1) {
          if ((arr[1] & settingChanged[index + 1][0]) > 0) {
            keyStrSet.push(getLang(arr[2]))
          }
        }
      })
    }
    if (settingChanged[index + 1][1] > 0) {
      Object.values(KeyData).forEach(arr => {
        if (arr[0] === 0) {
          if (arr[1] === settingChanged[index + 1][1]) {
            keyStrSet.push(getLang(arr[2]))
          }
        }
      })
    }
    if (settingChanged[index + 1][2] > 0) {
      Object.values(KeyData).forEach(arr => {
        if (arr[0] === 2) {
          if ((arr[1] & settingChanged[index + 1][2]) > 0) {
            keyStrSet.push(getLang(arr[2]))
          }
        }
      })
    }
    if (keyStrSet.length > 0) {
      nodeElement.innerHTML = keyStrSet.join(' + ')
    } else {
      nodeElement.innerHTML = getLang('keyN_null')
    }
  })
}

let cpG1
let cpG2

const initSettings = () => {
  //备份机器选项数据
  settingChanged = [...settingsSet.map(arr => [...arr])]
  //灯光模式单选框
  var radios = [...document.getElementsByName('lightsType')]
  radios.forEach(node => {
    node.checked = false
  })
  radios.forEach(radio => {
    if (radio.value === settingsSet[8][0].toString(10)) {
      radio.checked = true
    }
  })
  //灯光颜色
  document.getElementById('G1Color').value = `#${settingsSet[6][0]
    .toString(16)
    .padStart(2, '0')}${settingsSet[6][1]
    .toString(16)
    .padStart(2, '0')}${settingsSet[6][2].toString(16).padStart(2, '0')}`
  cpG1.value = document.getElementById('G1Color').value
  document.getElementById('G2Color').value = `#${settingsSet[7][0]
    .toString(16)
    .padStart(2, '0')}${settingsSet[7][1]
    .toString(16)
    .padStart(2, '0')}${settingsSet[7][2].toString(16).padStart(2, '0')}`
  cpG2.value = document.getElementById('G2Color').value
  //灯光亮度
  var G1Brightness = document.getElementById('G1Brightness')
  var G2Brightness = document.getElementById('G2Brightness')
  if (settingsSet[6][3]) {
    G1Brightness.innerHTML = `${((settingsSet[6][3] / 4) * 100) >> 0}%`
  } else {
    G1Brightness.innerHTML = '100%'
  }
  if (settingsSet[7][3]) {
    G2Brightness.innerHTML = `${((settingsSet[7][3] / 4) * 100) >> 0}%`
  } else {
    G2Brightness.innerHTML = '100%'
  }
  //消抖
  var delayInput = document.getElementById('delayInput')
  delayInput.value =
    settingsSet[9][0] * 0x01000000 +
    settingsSet[9][1] * 0x010000 +
    settingsSet[9][2] * 0x0100 +
    settingsSet[9][3]
  getVersion().then(getChipID)
  updateKeyCodeText()
  //极速模式
  if (settingsSet[10][0]) {
    document.getElementById('superSpeedOn').style.display = 'none'
    document.getElementById('superSpeedOff').removeAttribute('style')
  } else {
    document.getElementById('superSpeedOff').style.display = 'none'
    document.getElementById('superSpeedOn').removeAttribute('style')
  }
  // 夜灯
  var radios = [...document.getElementsByName('nightLightsType')]
  radios.forEach(node => {
    node.checked = false
  })
  radios.forEach(radio => {
    if (radio.value === settingsSet[10][2].toString(10)) {
      radio.checked = true
    }
  })

  // 灯光速度
  const DEFAULT_LIGHT_DELAY = 0x0a00
  const easeLightDelayInput = document.getElementById('easeLightDelayInput')
  easeLightDelayInput.value = (settingsSet[11][0] << 8) | settingsSet[11][1]
  if (
    easeLightDelayInput.value === 0x10000 ||
    easeLightDelayInput.value < 0x0a
  ) {
    easeLightDelayInput.value = DEFAULT_LIGHT_DELAY
  }
  const rainbowLightDelayInput = document.getElementById(
    'rainbowLightDelayInput'
  )
  rainbowLightDelayInput.value = (settingsSet[11][2] << 8) | settingsSet[11][3]
  if (
    rainbowLightDelayInput.value === 0x10000 ||
    rainbowLightDelayInput.value < 0x0a
  ) {
    rainbowLightDelayInput.value = DEFAULT_LIGHT_DELAY
  }
  countChanges()
}

const initSettingsFunction = () => {
  // 灯光模式
  var radios = [...document.getElementsByName('lightsType')]
  radios.forEach(node => {
    node.addEventListener('click', e => {
      settingChanged[8][0] = parseInt(node.value, 10)
      countChanges()
    })
  })
  // 初始化颜色选择器
  var colorGroupsCount = 2
  var colorOffset = 6
  for (let i = 0; i < colorGroupsCount; i++) {
    document.getElementById(`G${i + 1}Color`).addEventListener('change', e => {
      const target = settingChanged[colorOffset + i]
      target[0] = parseInt(
        document.getElementById(`G${i + 1}Color`).value.substr(1, 2),
        16
      )
      target[1] = parseInt(
        document.getElementById(`G${i + 1}Color`).value.substr(3, 2),
        16
      )
      target[2] = parseInt(
        document.getElementById(`G${i + 1}Color`).value.substr(5, 2),
        16
      )
      //target[3] =
      countChanges()
    })
  }
  // 初始化亮度选择器
  var G1Brightness = document.getElementById('G1Brightness')
  var G2Brightness = document.getElementById('G2Brightness')
  var G1BrightnessBtn = document.getElementById('G1BrightnessBtn')
  var G2BrightnessBtn = document.getElementById('G2BrightnessBtn')
  const G1BrightnessFun = e => {
    settingChanged[6][3]++
    if (settingChanged[6][3] > 4) {
      settingChanged[6][3] = 1
    }
    if (settingChanged[6][3]) {
      G1Brightness.innerHTML = `${((settingChanged[6][3] / 4) * 100) >> 0}%`
    } else {
      G1Brightness.innerHTML = '100%'
    }
    countChanges()
  }
  const G2BrightnessFun = e => {
    settingChanged[7][3]++
    if (settingChanged[7][3] > 4) {
      settingChanged[7][3] = 1
    }
    if (settingChanged[7][3]) {
      G2Brightness.innerHTML = `${((settingChanged[7][3] / 4) * 100) >> 0}%`
    } else {
      G2Brightness.innerHTML = '100%'
    }
    countChanges()
  }
  G1Brightness.addEventListener('click', G1BrightnessFun)
  G2Brightness.addEventListener('click', G2BrightnessFun)
  G1BrightnessBtn.addEventListener('click', G1BrightnessFun)
  G2BrightnessBtn.addEventListener('click', G2BrightnessFun)
  // 初始化去抖
  document.getElementById('delayInput').addEventListener('change', e => {
    var value = parseInt(document.getElementById('delayInput').value)
      .toString(16)
      .padStart(8, '0')
    settingChanged[9][0] = parseInt(value.substr(0, 2), 16)
    settingChanged[9][1] = parseInt(value.substr(2, 2), 16)
    settingChanged[9][2] = parseInt(value.substr(4, 2), 16)
    settingChanged[9][3] = parseInt(value.substr(6, 2), 16)
    countChanges()
  })
  //键值设置
  var keyNum = 5
  const keyInfoArr = [
    ...document
      .getElementById('btnSettingsList')
      .getElementsByClassName('rightP')
  ]
  let oneKeyCode = [0x00, 0x00, 0x00]
  const keyboardPannel = document.getElementById('keyboardPannel')
  keyboardPannel.addEventListener('click', e => e.stopPropagation())
  const updateKeyBoard = () => {
    const keyPosSet = []
    if (oneKeyCode[0] > 0) {
      for (let k in KeyData) {
        let arr = KeyData[k]
        if (arr[0] === 1) {
          if ((arr[1] & oneKeyCode[0]) > 0) {
            keyPosSet.push(k)
          }
        }
      }
    }
    if (oneKeyCode[1] > 0) {
      for (let k in KeyData) {
        let arr = KeyData[k]
        if (arr[0] === 0) {
          if (arr[1] === oneKeyCode[1]) {
            keyPosSet.push(k)
          }
        }
      }
    }
    if (oneKeyCode[2] > 0) {
      for (let k in KeyData) {
        let arr = KeyData[k]
        if (arr[0] === 2) {
          if ((arr[1] & oneKeyCode[2]) > 0) {
            keyPosSet.push(k)
          }
        }
      }
    }
    ;[...keyboardPannel.getElementsByClassName('key')].forEach(nodeEle => {
      removeClassName(nodeEle, 'select')
    })
    keyPosSet.forEach(keys => {
      const line = parseInt(keys.substr(0, 1))
      const col = parseInt(keys.substr(1, 2))
      addClassName(
        keyboardPannel
          .getElementsByClassName('keyboard-line')
          [line - 1].getElementsByClassName('key')[col - 1],
        'select'
      )
    })
  }
  keyInfoArr.forEach((e, index) => {
    e.addEventListener('click', event => {
      keyboardPannel.style.top = e.offsetTop + 24 + 'px'
      oneKeyCode = settingChanged[index + 1]
      oneKeyCode[0] = settingChanged[index + 1][0]
      oneKeyCode[1] = settingChanged[index + 1][1]
      addClassName(keyboardPannel, 'show')
      event.stopPropagation()
      const clickFun = () => {
        window.removeEventListener('click', clickFun)
        // keyInfoArr.forEach(element =>
        //   element.removeEventListener('click', clickFun)
        // )
        removeClassName(keyboardPannel, 'show')
      }
      window.addEventListener('click', clickFun)
      //e.addEventListener('click', clickFun)
      updateKeyBoard()
    })
  })

  for (let keys in KeyData) {
    const line = parseInt(keys.substr(0, 1))
    const col = parseInt(keys.substr(1, 2))
    keyboardPannel
      .getElementsByClassName('keyboard-line')
      [line - 1].getElementsByClassName('key')[col - 1].dataset.keyKey = keys
  }
  ;[...keyboardPannel.getElementsByClassName('key')].forEach(nodeEle => {
    nodeEle.addEventListener('click', event => {
      if (KeyData[nodeEle.dataset.keyKey][0] === 1) {
        oneKeyCode[0] ^= KeyData[nodeEle.dataset.keyKey][1]
      } else if (KeyData[nodeEle.dataset.keyKey][0] === 2) {
        oneKeyCode[2] ^= KeyData[nodeEle.dataset.keyKey][1]
      } else if (oneKeyCode[1] === KeyData[nodeEle.dataset.keyKey][1]) {
        oneKeyCode[1] = 0x00
      } else {
        oneKeyCode[1] = KeyData[nodeEle.dataset.keyKey][1]
      }
      updateKeyCodeText()
      updateKeyBoard()
      countChanges()
    })
  })

  // 夜灯
  var radios = [...document.getElementsByName('nightLightsType')]
  radios.forEach(node => {
    node.addEventListener('click', e => {
      settingChanged[10][2] = parseInt(node.value, 10)
      countChanges()
    })
  })

  // 灯光速度
  const easeLightDelayInput = document.getElementById('easeLightDelayInput')
  easeLightDelayInput.addEventListener('change', e => {
    const trueValue = easeLightDelayInput.value
    settingChanged[11][0] = (trueValue & 0xff00) >> 8
    settingChanged[11][1] = trueValue & 0x00ff
    countChanges()
  })
  const rainbowLightDelayInput = document.getElementById(
    'rainbowLightDelayInput'
  )
  rainbowLightDelayInput.addEventListener('change', e => {
    const trueValue = rainbowLightDelayInput.value
    settingChanged[11][2] = (trueValue & 0xff00) >> 8
    settingChanged[11][3] = trueValue & 0x00ff
    countChanges()
  })
}

// 默认数据
const templeData = [
  [0x01, 0x00, 0x1d, 0x00, 0x00], //Z
  [0x02, 0x00, 0x1b, 0x00, 0x00], //X
  [0x03, 0x01, 0x15, 0x00, 0x00], //Ctrl+R
  [0x04, 0x00, 0x29, 0x00, 0x00], //ESC
  [0x05, 0x00, 0x3b, 0x00, 0x00], //F3
  [0x06, 0x00, 0xff, 0x00, 0x04], //#00FF00 100%(4)
  [0x07, 0x00, 0x00, 0xff, 0x04], //#0000FF 100%(4)
  [0x08, 0x06, 0x00, 0x00, 0x00], //Mode 6, 彩虹
  [0x09, 0x00, 0x00, 0x00, 0x60], //0x60 => 96 (MAX 16^6-1)
  [0x0a, 0x00, 0x00, 0x00, 0x40], //0x00 极速模式处于关闭，夜灯打开
  [0x0b, 0x0a, 0x00, 0x0a, 0x00] //0x0A00 延迟设置
]
templeData.forEach(arr => {
  arr[5] = arr[1] ^ arr[2] ^ arr[3] ^ arr[4]
})
// 灯光测试数据
// const lightTestData = [
//   [0x06, 0xff, 0xff, 0xff, 0x04], //#FFFFFF 100%(4)
//   [0x07, 0xff, 0xff, 0xff, 0x04], //#FFFFFF 100%(4)
//   [0x08, 0x02, 0x00, 0x00, 0x00] //Mode 0
// ]
// lightTestData.forEach(arr => {
//   arr[5] = arr[1] ^ arr[2] ^ arr[3] ^ arr[4]
// })
const useSettings = () => {
  if (changesBool.filter(e => e).length > 0) {
    var promiseObj = new Promise(r => {
      page4Init()
      jumpPage(3)
      r()
    })
    for (let i = 0; i < changesBool.length; i++) {
      if (changesBool[i]) {
        promiseObj = promiseObj.then(() =>
          sendData([
            i,
            settingChanged[i][0],
            settingChanged[i][1],
            settingChanged[i][2],
            settingChanged[i][3],
            settingChanged[i][0] ^
              settingChanged[i][1] ^
              settingChanged[i][2] ^
              settingChanged[i][3],
            0x00,
            0x00
          ])
        )
      }
    }
    promiseObj = promiseObj.then(() => {
      getAllSettings().then(() => {
        initSettings()
        countChanges()
        setTimeout(() => {
          page4Fin()
        }, 300)
      })
    })
  }
}

const changesBool = Array(settingsSet.length).fill(false)
var changesLength = 0

const countChanges = () => {
  const isDiffArr = (a, b) => {
    if (a.length !== b.length) return true
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true
    }
    return false
  }
  for (var i = 0; i < settingsSet.length; i++) {
    changesBool[i] = isDiffArr(settingsSet[i], settingChanged[i])
  }
  changesLength = changesBool.filter(e => e).length
  document.getElementById('changesCountValue').innerHTML = changesLength
  if (changesLength > 0) {
    removeClassName(document.getElementById('changesCount'), 'hide')
  } else {
    addClassName(document.getElementById('changesCount'), 'hide')
  }
}

/**
 *
 * @param {HTMLDocument} document
 * @param {{connect:HID.HID,info:{vendorId: number;productId: number;description: string;endpoint: string;},devices:amy[]}} deviceObj
 * @param {{sendData:(buffer: any, deviceIn?: any) => Promise<any>,page4Init: () => void,page4Fin: () => void,jumpPage: (to: any) => void}} funs
 */
const funs = (documentElement, deviceObj, funs) => {
  document = documentElement
  device = deviceObj.connect
  deviceInfo = deviceObj.info
  devices = deviceObj.devices
  sendData = funs.sendData
  page4Fin = funs.page4Fin
  page4Init = funs.page4Init
  jumpPage = funs.jumpPage
  getLang = funs.getLang

  getDataFunction = {
    get fun() {
      return funs.getData
    },
    set fun(val) {
      funs.getData = data => {
        let consoleInfo = ''
        ;[...data].forEach(
          d => (consoleInfo += d.toString(16).padStart(2, '0'))
        )
        console.log('Get Device Data: ' + consoleInfo)
        return val(data)
      }
    }
  }

  // 根据设备数量显示或隐藏测试按钮
  if (devices && devices.length > 1) {
    addClassName(document.getElementById('sendAllNewDev'), 'show')
    addClassName(document.getElementById('lightTest'), 'show')
  } else {
    removeClassName(document.getElementById('sendAllNewDev'), 'show')
    removeClassName(document.getElementById('lightTest'), 'show')
  }

  // 直接发送数据包 按钮
  document.getElementById('sendBtn').addEventListener('click', e => {
    if (device) {
      var buffer = Array(8).fill(0x00)
      document
        .getElementById('toSend')
        .value.split(' ')
        .map((str, no) => {
          buffer[no] = parseInt(str, 16)
          return no + 1
        }, 0)
      if (os.platform() === 'win32' || os.platform() === 'darwin') {
        buffer.unshift(0) // prepend throwaway byte
      }
      device.write(buffer)
    }
  })

  // 跳转到 Boot 模式
  document.getElementById('jumpToBootMode').addEventListener('click', e => {
    sendData([0x00, 0x0b, 0x00, 0x00, 0x00, 0x0b]).then(() => {
      // page4Init()
      // jumpPage(3)
      // setTimeout(page4Fin, 300)
      // const execFile = require('child_process').execFile
      // const cmd = execFile(path.join(__dirname, '/DRIVER/SETUP.EXE'), ['/S'], {
      //   // detached: true,
      //   // stdio: 'ignore',
      //   //shell: true,
      //   cwd: __dirname + '\\DRIVER',
      //   windowsHide: false
      // })
    })
    // const cmd = execFile(path.join(__dirname, '/DRIVER/SETUP.EXE'), ['/S'], {
    //   // detached: true,
    //   // stdio: 'ignore',
    //   //shell: true,
    //   cwd: __dirname + '\\DRIVER',
    //   windowsHide: false
    // })
  })

  // 重置一台机器按钮
  document.getElementById('sendNewDev').addEventListener('click', e => {
    var promiseObj
    if (device) {
      page4Init()
      jumpPage(3)
      templeData.forEach(data => {
        if (promiseObj) {
          promiseObj.then(() => sendData(data))
        } else {
          promiseObj = sendData(data)
        }
      })
      promiseObj.then(() =>
        getAllSettings().then(() => {
          initSettings()
          setTimeout(page4Fin, 300)
          //countChanges()
        })
      )
    }
  })
  // 重置全部机器按钮
  document.getElementById('sendAllNewDev').addEventListener('click', e => {
    var promiseObj
    if (devices && devices.length && devices.length > 0) {
      page4Init()
      jumpPage(3)
      devices.forEach(d => {
        let deviceToSend = new HID.HID(d.path)
        templeData.forEach(data => {
          if (promiseObj) {
            promiseObj.then(() => sendData(data, deviceToSend))
          } else {
            promiseObj = sendData(data, deviceToSend)
          }
        })
      })
      promiseObj.then(() =>
        getAllSettings().then(() => {
          initSettings()
          setTimeout(page4Fin, 300)
          //countChanges()
        })
      )
    }
  })
  // 灯光测试按钮
  // document.getElementById('lightTest').addEventListener('click', e => {
  //   var promiseObj
  //   if (devices && devices.length && devices.length > 0) {
  //     page4Init()
  //     jumpPage(3)
  //     devices.forEach(d => {
  //       let deviceToSend = new HID.HID(d.path)
  //       lightTestData.forEach(data => {
  //         if (promiseObj) {
  //           promiseObj.then(() => sendData(data, deviceToSend))
  //         } else {
  //           promiseObj = sendData(data, deviceToSend)
  //         }
  //       })
  //     })
  //     promiseObj.then(() =>
  //       getAllSettings().then(() => {
  //         initSettings()
  //         setTimeout(page4Fin, 300)
  //         //countChanges()
  //       })
  //     )
  //   }
  // })

  //初始化两个取色器
  cpG1 = new ColorPicker({
    dom: document.getElementById('setG1ColorPicker'),
    value: document.getElementById('G1Color').value
  })
  cpG1.addEventListener('change', event => {
    document.getElementById('G1Color').value = cpG1.value
    document.getElementById('G1Color').dispatchEvent(new Event('change'))
  })

  cpG2 = new ColorPicker({
    dom: document.getElementById('setG2ColorPicker'),
    value: document.getElementById('G2Color').value
  })
  cpG2.addEventListener('change', event => {
    document.getElementById('G2Color').value = cpG2.value
    document.getElementById('G2Color').dispatchEvent(new Event('change'))
  })

  const cpArr = [cpG1.getDOM(), cpG2.getDOM()]
  let upFlag = false
  cpG1.getDOM().addEventListener('mousedown', () => {
    cpG1.getDOM().style.display = 'block'
    cpG1.getDOM().style.animation = 'fadeInFromNone 0.2s ease-in'
    upFlag = false
  })
  cpG2.getDOM().addEventListener('mousedown', () => {
    cpG2.getDOM().style.display = 'block'
    cpG2.getDOM().style.animation = 'fadeInFromNone 0.2s ease-in'
    upFlag = false
  })
  cpArr.forEach(e => e.addEventListener('click', e => e.stopPropagation()))
  document.addEventListener('mouseup', () => {
    setTimeout(() => (upFlag = true), 0)
  })
  document.addEventListener('click', () => {
    if (upFlag) {
      cpArr.forEach(e => e.removeAttribute('style'))
    }
    //document.removeEventListener('click', clickFun)
  })

  // 取色器初始化结束

  document
    .getElementById('useSettings')
    .addEventListener('click', e => useSettings())

  document.getElementById('abandonsChanges').addEventListener('click', e => {
    initSettings()
    //countChanges()
  })

  document.getElementById('superSpeedOn').addEventListener('click', e => {
    settingChanged[10][0] = 0x01
    countChanges()
    // sendData([0x0a, 0x01, 0x00, 0x00, 0x00, 0x01]).then(() => {
    //   page4Init()
    //   jumpPage(3)
    //   setTimeout(page4Fin, 300)
    // })
  })

  document.getElementById('superSpeedOff').addEventListener('click', e => {
    settingChanged[10][0] = 0x00
    countChanges()
    // sendData([0x0a, 0x00, 0x00, 0x00, 0x00, 0x00]).then(() => {
    //   page4Init()
    //   jumpPage(3)
    //   setTimeout(page4Fin, 300)
    // })
  })

  var rightPannel = document.getElementById('rightPannel')
  var scrollStatus = new Array(5).fill(false)
  scrollStatus[0] = true
  const rightPannelSections = [...rightPannel.getElementsByTagName('section')]

  const leftPannelSpans = [
    ...document.getElementById('leftPannel').getElementsByTagName('span')
  ].slice(0, 5)

  const refreshLeftPannel = () => {
    for (var i = 0; i < scrollStatus.length; i++) {
      if (scrollStatus[i]) {
        addClassName(leftPannelSpans[i], 'activeTitle')
      } else {
        removeClassName(leftPannelSpans[i], 'activeTitle')
      }
    }
  }

  const checkScroll = () => {
    var scrollTop = rightPannel.scrollTop
    rightPannelSections.forEach(node => {
      if (scrollTop + 144 > node.offsetTop) {
        scrollStatus.fill(false)
        scrollStatus[rightPannelSections.indexOf(node)] = true
      }
    })
    refreshLeftPannel()
  }
  rightPannel.addEventListener('scroll', e => checkScroll())

  var raf
  const easeOut = x => {
    if (x > 1) x = 1
    if (x < 0) x = 0
    return 1 - Math.pow(1 - x, 2)
  }

  const leftPannelScrollTo = (i, t = 300) => {
    if (t === 0) {
      rightPannel.scrollTop = rightPannelSections[i].offsetTop - 46
      return
    }
    var timeStart
    var timeLong = t
    var scrollFrom = rightPannel.scrollTop
    var scrollGo = rightPannelSections[i].offsetTop - 46 - rightPannel.scrollTop
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(function autoRun(t) {
      if (!timeStart) {
        timeStart = t
      }
      rightPannel.scrollTop =
        easeOut((t - timeStart) / timeLong) * scrollGo + scrollFrom
      checkScroll()
      if (!(t - timeStart >= timeLong)) {
        raf = requestAnimationFrame(autoRun)
      }
    })
  }
  for (let i = 0; i < leftPannelSpans.length; i++) {
    leftPannelSpans[i].addEventListener('click', e => {
      leftPannelScrollTo(i)
    })
  }

  const bigBtn = [...document.getElementsByClassName('bigBtn')]
  for (let i = 0; i < bigBtn.length; i++) {
    bigBtn[i].addEventListener('click', e => {
      if (settingsAlready) {
        jumpPage(2)
        leftPannelScrollTo(i, 0)
      } else {
        getAllSettings().then(() => {
          jumpPage(2)
          leftPannelScrollTo(i, 0)
        })
      }
    })
  }

  let checkROMUpdateBoolean = false
  let checkROMUpdateTimer
  document.getElementById('checkROMUpdate').addEventListener('click', e => {
    if (!checkROMUpdateBoolean) {
      checkROMUpdateBoolean = true
      checkROMUpdateTimer = setTimeout(
        () => (checkROMUpdateBoolean = false),
        5000
      )

      document.getElementById('checkROMUpdate').innerText = getLang(
        'pleaseWait'
      )
      const xhr = new XMLHttpRequest()
      xhr.open(
        'GET',
        encodeURI(
          'http://simshop.po-i.cc:8117/check-roms/' +
            deviceInfo.description +
            '.json'
        )
      )
      xhr.addEventListener('loadend', e => {
        let succ = false
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status === 200 || xhr.status === 304) {
            if (xhr.responseText) {
              succ = true
              // DO something
              document.getElementById('checkROMUpdate').innerText = getLang(
                document.getElementById('checkROMUpdate').dataset.langKey
              )
              const obj = JSON.parse(xhr.responseText)
              if (obj.version > nowVersion) {
                if (
                  confirm(`Find v${obj.version} with
${getLang('info', obj.description)}
Update Now?`)
                ) {
                  setTimeout(() => {
                    let httpObj
                    if (obj.url.indexOf('https') > -1) {
                      httpObj = require('https')
                    } else {
                      httpObj = require('http')
                    }
                    const fs = require('fs')
                    const crypto = require('crypto')
                    let filePath = path.join(os.tmpdir(), 'simpadUpdate.hex')
                    let file = fs.createWriteStream(filePath)
                    httpObj.get(obj.url, res => {
                      res.setEncoding('binary')
                      let fileData = ''
                      res.on('data', chunk => {
                        file.write(chunk)
                        fileData += chunk
                      })
                      res.on('end', () => {
                        file.end()
                        const md5 = crypto
                          .createHash('md5')
                          .update(fileData)
                          .digest('hex')
                        if (obj.md5 !== md5) {
                          return alert(
                            `Wrong File!!!\nShould be ${
                              obj.md5
                            }\nYou got ${md5}`
                          )
                        }
                        setTimeout(() => {
                          const updateWin = new electron.remote.BrowserWindow()
                          updateWin.loadURL(path.join(__dirname, 'update.html'))
                          updateWin.webContents.on('did-finish-load', () => {
                            updateWin.webContents.send('hexPath', filePath)
                          })
                          // updateWin.webContents.openDevTools()
                          updateWin.show()
                        }, 200)
                      })
                    })
                  }, 200)
                  sendData([0x00, 0x0b, 0x00, 0x00, 0x00, 0x0b])
                }
              } else {
                checkROMUpdateBoolean = true
                clearTimeout(checkROMUpdateTimer)
                // DO something
                document.getElementById('checkROMUpdate').innerText = getLang(
                  'isLatestVersion'
                )
              }
              // alert(
              //   `${getName(deviceInfo.description)}\nversion ${
              //     obj.version
              //   }\nfron ${obj.url}\nwith ${getLang('info',obj.description)}`
              // )
            }
          }
        }
        if (!succ) {
          document.getElementById('checkROMUpdate').innerText = getLang(
            'checkUpdateFailed'
          )
        }
      })
      xhr.send()
    }
  })

  // document.getElementById('installDriver').addEventListener('click', () => {
  //   document.getElementById('installDriver').disabled = true
  //   const execFile = require('child_process').execFile
  //   const cmd = execFile(path.join(__dirname, '/DRIVER/SETUP.EXE'), ['/S'], {
  //     // detached: true,
  //     // stdio: 'ignore',
  //     // shell: true,
  //     cwd: __dirname + '\\DRIVER',
  //     windowsHide: false
  //   })
  //   cmd.once('close', () => {
  //     document.getElementById('installDriver').disabled = true
  //   })
  // })

  Array.prototype.forEach.call(
    document.querySelectorAll("input[type='color']"),
    e => {
      e.addEventListener('click', e => e.preventDefault())
    }
  )
  document.getElementById(
    'theBtnDefInner'
  ).style.background = `url("${__dirname.replace(/\\/g, '/') +
    '/imgs/deviceKeyInfo.png'}")`
  // 灯光配置信息显示
  document.getElementById(
    'theLightDefInner'
  ).style.background = `url("${__dirname.replace(/\\/g, '/') +
    '/imgs/deviceLightInfo.png'}")`

  document.getElementById('deviceKeyMapTitle').innerText = getName(
    deviceInfo.description
  )

  // 灯光配置信息设备标题
  document.getElementById('deviceLightTitle').innerText = getName(
    deviceInfo.description
  )

  getAllSettings().then(() => initSettings())
  initSettingsFunction()
}

const animeLights = () => {
  const childProcess = require('child_process')

  let valueToShow = 0
  let valLastTime = 0
  let delaySet = 0
  const highVolDelay = 25
  let maxVal = 0
  let maxValSetTime = 0
  let nowTime = 0

  const showAnimeVal = valNum => {
    nowTime = performance.now()
    if (valNum > maxVal) {
      maxVal = valNum
      maxValSetTime = nowTime
    } else if (performance.now() - maxValSetTime > 10000 && valNum > 0) {
      maxVal = valNum
      maxValSetTime = nowTime
    }
    if (performance.now() - delaySet < highVolDelay) {
      if (valNum > valLastTime * 1.1 && valNum > maxVal * 0.2) {
        valueToShow = 100
        delaySet = nowTime
        if (performance.now() - maxValSetTime > 2000) {
          maxVal = valNum
          maxValSetTime = nowTime
        }
      }
      valLastTime = valNum
      return
    }
    if (valNum > valLastTime) {
      if (valNum > valLastTime * 1.08 && valNum > maxVal * 0.2) {
        valueToShow = 100
        delaySet = nowTime
      } else if (valNum > valLastTime * 1.06 && valNum > maxVal * 0.2) {
        valueToShow *= 1.5
        valueToShow += 15
      } else if (valNum > valLastTime * 1.02 && valNum > maxVal * 0.2) {
        valueToShow *= 1.3
        valueToShow += 10
      } else if (valNum > maxVal * 0.2) {
        valueToShow *= 1.2
        valueToShow += 10
      }
      if (valueToShow > 100) {
        valueToShow = 100
      }
    } else {
      valueToShow *= 0.98
      valueToShow -= 1
    }
    valLastTime = valNum
    if (valueToShow <= 0) {
      valueToShow = 0
    }
    const val = Math.round((valueToShow * 0xff) / 100)
    if (val > 0xff) {
      val = 0xff
    }
    sendData([0x00, 0x03, 0xff, Math.round(val * 0.7), 0, val])
  }

  const autoReloadVolProcess = () => {
    const osValProcess = childProcess.execFile(
      path.join(__dirname, '/LIGHT_CONTROLLER/OSVol.exe')
    )
    let tempChunkNum
    osValProcess.stdout.on('data', chunk => {
      tempChunkNum = parseFloat(chunk)
      if (Number.isFinite(tempChunkNum)) {
        showAnimeVal(tempChunkNum)
      }
    })
    osValProcess.on('close', () => {
      console.log('osVal Closed')
      osValProcess.kill()
      autoReloadVolProcess()
    })
  }
  autoReloadVolProcess()
}
// animeLights()

module.exports = funs
