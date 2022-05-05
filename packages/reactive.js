
// 用全局变量存储被注册的副作用函数
let activeEffect
const bucked = new WeakMap()
const ITERATE_KEY = Symbol()
function reactive(obj) {
    return new Proxy(obj, {
        // 拦截读取操作
        get(target, key, receiver) {
            track(target, key)
            return Reflect.get(target, key, receiver)
        },
        // 拦截设置操作
        set(target, key, newValue, receiver) {
            // 如果属性不存在则说明在添加属性，否则是设置已有的属性
            const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
            // 设置属性值
            const res = Reflect.set(target, key, newValue, receiver)
            // 将 type 作为第三个参数传给 trigger
            trigger(target, key, type)
            return res
        },
        deleteProperty(target, key) {
            // 检查被操作的属性是否是对象自己的属性
            const hadKey = Object.prototype.hasOwnProperty.call(target, key)
            // 使用 Reflect.deleteProperty 完成属性的删除
            const res = Reflect.deleteProperty(target, key)
            if (res && hadKey) {
                // 只有当被删除的属性是对象自己的属性并且删除成功时，才触发更新
                trigger(target, key, 'DELETE')
            }
            return res
        },
        // 通过 has 拦截函数实现对 in 操作符的代理
        has(target, key) {
            track(target, key)
            return Reflect.has(target, key)
        },
        // 拦截 for in
        ownKeys(target) {
            track(target, ITERATE_KEY)
            return Reflect.ownKeys(target)
        }
    })
}

function track(target, key) {
    // 没有 activeEffect 直接 return
    if (!activeEffect) return target[key]
    // 根据 target 从桶中获取 depsMap , 他是一个 map 类型: key --> effects
    let depsMap = bucked.get(target)
    if (!depsMap) {
        bucked.set(target, (depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key, (deps = new Set()))
    }
    deps.add(activeEffect)
    activeEffect.deps.push(deps)
}

function trigger(target, key, type) {
    const depsMap = bucked.get(target)
    if (!depsMap) return
    const effects = depsMap.get(key)
    const iterateEffects = depsMap.get(ITERATE_KEY)
    // 最后重置 effectFn 的 deps 数组
    const effectToRun = new Set()
    effects && effects.forEach(fn => {
        if (activeEffect !== fn) {
            effectToRun.add(fn)
        }
    })
    // 只有当 type 是 ADD 时才触发 ITERATE_KEY 相关的副作用函数
    if (type === 'ADD' || type === 'DELETE') {
        // 将与 ITERATE_KEY 相关的副作用函数也添加到 effectToRun，处理 for in 相关
        iterateEffects && iterateEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectToRun.add(effectFn)
            }
        })
    }
    
    effectToRun.forEach(effectFn => {
        // 判断副作用函数是否有调度器，有则调用调度器并将副作用函数作为参数传递给调度器
        if (effectFn.options.scheduler){
            effectFn.options.scheduler(effectFn)
        } else {
            // 否则直接执行副作用函数
            effectFn()
        }
    })
}

function cleanup(effectFn) {
    // 遍历 effect 的 deps 数组
    for (let i = 0; i < effectFn.deps.length; i++) {
        // deps 是依赖集合
        const deps = effectFn.deps[i]
        // 将 effectFn 从依赖集合中删除
        deps.delete(effectFn)
    }

    effectFn.deps.length = 0
}

// 定义一个任务队列
const jobQueue = new Set()
// 创建一个 Promise 实例，我们用他将一个任务添加到微任务队列
const p = Promise.resolve()
// 一个标志代表是否在刷新队列
let isFlushing = false
function flushJob() {
    // 如果队列在刷新，则什么都不做
    if (isFlushing) return
    // 设置为 true ， 代表正在刷新
    isFlushing = true
    // 在微任务队列中刷新 jobQueue 队列
    p.then(() => {
        jobQueue.forEach(job => job())
    }).finally(() => {
        // 结束后重置 isFlushing
        isFlushing = false
    })
}

// 计算属性
function computed(getter) {
    let value
    let dirty = true
    const effectFn = effect(getter, {
        lazy: true,
        // 添加调度器，当数据放生变化时，标记为需要重新计算
        scheduler() {
            if (!dirty) {
                dirty = true
                // 计算属性依赖的响应式数据发生变化时，手动调用 trigger 函数触发相应
                trigger(obj, 'value')
            }
        }
    })

    const obj = {
        get value() {
            if (dirty) {
                value = effectFn()
                dirty = false
            }
            // 当读取 value 时，手动调用 track 函数进行追踪
            track(obj, 'value')
            return value
        }
    }
    return obj
}

// 监听属性 watch 的实现原理
function watch(source, cb, options = {}) {
    let getter
    if (typeof source === 'function') {
        getter = source
    } else {
        getter = () => traverse(source)
    }

    // 过期的副作用原理
    let cleanup
    function onInvalidate(fn) {
        if(cleanup) {
            cleanup = fn
        }
    }

    let oldValue, newValue
    const job = () => {
        newValue = effectFn()
        // 在调用 cb 回调函数之前，先调用过期回调
        if (cleanup) {
            cleanup()
        }
        // 将 onInvalidate 作为回调的第三个参数，以便用户使用
        cb(oldValue, newValue, onInvalidate)
        oldValue = newValue
    }

    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler: () => {
                // 在调度函数中判断 flush 是否为 post，如果是，将它放到微任务队列中执行
                if (options.flush === 'post'){
                    const p =Promise.resolve()
                    p.then(job)
                } else {
                    job()
                }
            }
        }
    )
    // 是否立即执行
    if (options.immediate) {
        job()
    } else {
        oldValue = effectFn()
    }
    
}

function traverse(value, seen = new Set()) {
    if (typeof value !== 'object' || value === null || seen.has(value)) return
    seen.add(value)
    // 暂时不考虑数组等其他结构
    // 假设 value 就是一个对象
    for (let key in value) {
        traverse(value[key], seen)
    }
    return value
}

const effectStack = []
function effect(fn, options={}) {
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        const res = fn();
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
        return res;
    }
    effectFn.deps = []
    effectFn.options = options
    if (!options.lazy) {
        effectFn()
    }
    return effectFn
}