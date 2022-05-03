// 渲染器函数的实现
const Text = Symbol();
const Comment = Symbol();
const Fragment = Symbol();
// 全局变量，存储当前正在初始化的组件实例
let currentInstance = null
// 设置组件实例
function setCurrentInstance(instance) {
    currentInstance = instance
}
function onMounted(fn) {
    if (currentInstance) {
        currentInstance.mounted.push(fn)
    } else {
        console.error('onMounted 函数只能在 setup 中调用')
    }
}
function createRenderer(options) {
    const {
        createElement,
        setElementText,
        insert,
        patchProps,
        createText,
        setText,
        createComment,
        setComment
    } = options;

    function mountElement(vnode, container, anchor) {
        const el = vnode.el = createElement(vnode.type);

        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children);
        } else if (Array.isArray(vnode.children)) {
            vnode.children.forEach(child => {
                patch(null, child, el);
            });

        }

        if (vnode.props) {
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key])
            }
        }
        insert(el, container, anchor);
    }

    function patch(n1, n2, container, anchor) {
        // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
        if (n1 && n1.type !== n2.type) {
            unmount(n1);
            n1 = null;
        }
        const { type } = n2;
        if (typeof type === 'string') {
            if (!n1) {
                // 如果 n1 不存在表示意味着挂载，调用 mountElement 函数完成挂载
                mountElement(n2, container, anchor);
            } else {
                // n1 存在，意味着打补丁
                patchElement(n1, n2);
            }
        } else if (typeof type === 'object') {
            // 如果 n2 的 type 是个对象，那就说明是个组件
            if (!n1) {
                mountComponent(n2, container, anchor);
            } else {
                patchComponent(n1, n2, anchor);
            }
        } else if (type === Text) {
            // 文本节点
            if (!n1) {
                const el = n2.el = createText(n2.children);
                insert(el, container);
            } else {
                const el = n2.el = n1.el;
                if (n2.children !== n1.children) {
                    setText(el, n2.children);
                }
            }
        } else if (type === Comment) {
            // 注释节点
            if (!n1) {
                const el = n2.el = createComment(n2.children);
                insert(el, container);
            } else {
                const el = n2.el = n1.el;
                if (n2.children !== n1.children) {
                    setComment(el, n2.children);
                }
            }
        } else if (type === Fragment) {
            if (!n1) {
                n2.children.forEach(c => patch(null, c, container));
            } else {
                patchChildren(n1, n2, container);
            }
        }
    }

    function render(vnode, container) {
        if (vnode) {
            patch(container._vnode, vnode, container);
        } else {
            if (container._vnode) {
                // document.body.innerHTML = '';
                unmount(container._vnode);

            }
        }
        container._vnode = vnode;
    }

    function unmount(vnode) {
        // 在卸载时如果 vnode 类型为 Fragment，则需要卸载其 children
        if (vnode.type === Fragment) {
            vnode.children.forEach(c => unmount(c));
            return;
        }
        const parent = vnode.el.parentNode;
        if (parent) parent.removeChild(vnode.el);
    }

    function patchElement(n1, n2) {
        const el = n2.el = n1.el;
        const oldProps = n1.props;
        const newProps = n2.props;
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key]);
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) {
                patchProps(el, key, oldProps[key], null);
            }
        }
        patchChildren(n1, n2, el);
    }

    function patchChildren(n1, n2, container) {
        // 判断新子节点是一个文本节点
        if (typeof n2.children === 'string') {
            if (Array.isArray(n1.children)) {
                n1.children.forEach(c => unmount(c));
            }
            setElementText(container, n2.children);
        } else if (Array.isArray(n2.children)) {
            patchKeyeChildren(n1, n2, container);

        } else {
            // 代码运行到这里，说明新子节点不存在
            if (Array.isArray(n1.children)) {
                n1.children.forEach(c => unmount(c));
            } else {
                setElementText(container, '');
            }
        }
    }

    // 快速 Diff 算法的原理
    function patchKeyeChildren(n1, n2, container) {
        const oldChildren = n1.children;
        const newChildren = n2.children;
        
        // 更新相同的前置节点
        let j = 0;
        let oldVNode = oldChildren[j];
        let newVNode = newChildren[j];
        while (oldVNode.key === newVNode.key) {
            patch(oldVNode, newVNode, container);
            j++;
            oldVNode = oldChildren[j];
            newVNode = newChildren[j];
        }

        // 更新相同的后置节点
        let oldEnd = oldChildren.length - 1;
        let newEnd = newChildren.length - 1;
        oldVNode = oldChildren[oldEnd];
        newVNode = newChildren[newEnd];
        while(oldVNode.key === newVNode.key) {
            patch(oldVNode, newVNode, container);
            oldEnd--;
            newEnd--;
            oldVNode = oldChildren[oldEnd];
            newVNode = newChildren[oldEnd];
        }

        // 处理完毕后满足以下条件则说明 
        if (j > oldEnd && j <= newEnd) {
            // 新增元素
            const anchorIndex = newEnd + 1;
            const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
            while (j <= newEnd) {
                patch(null, newChildren[j++], container, anchor);
            }
        } else if (j > newEnd && j <= oldEnd) {
            // 删除节点
            while (j <= oldEnd) {
                unmount(oldChildren[j++]);
            }
        } else {
            const count = newEnd - j + 1;
            const source = new Array(count);
            source.fill(-1);

            // oldStart 和 newStart 分别为起始索引，即 j
            const oldStart = j;
            const newStart = j;
            
            // 构建索引表
            const keyIndex = {};
            
            let moved = false;
            let pos = 0;
            for (let i = newStart; i <= newEnd; i++) {
                keyIndex[newChildren[i].key] = i;
            }
            // 代表更新过的节点数量
            let patched = 0;
            // 遍历旧的一组节点中剩余未处理的节点
            for (let i = oldStart; i <= oldEnd; i++) {
                oldVNode = oldChildren[i];
                // 如果更新过的节点数量小于等于需要更新的节点数量，则执行更新
                if (patched <= count) {
                    
                    // 通过索引表快速找到新的一组节点中具有相同 key 值的节点位置
                    const k = keyIndex[oldVNode.key];
                    if (typeof k !== 'undefined') {
                        newVNode = newChildren[k]
                        // 调用 patch 函数完成更新
                        patch(oldVNode, newVNode, container);
                        // 每次更新一个节点都将 patched 加一
                        patched++;
                        // 填充 source 数组
                        source[k - newStart] = i;
                        // 判断节点是否需要移动
                        if (k < pos) {
                            moved = true;
                        } else {
                            pos = k;
                        }
                    } else {
                        // 没找到
                        unmount(oldVNode);
                    }
                } else {
                    // 如果更新过的节点数量大于需要更新的节点数量，则卸载多余的节点
                    unmount(oldVNode);
                }
            }

            // 移动元素
            if (moved) {
                const seq = getSequence(source);
                // s 指向最长递增序列的最后一个元素
                let s = seq.length - 1;
                // i 指向新的一组子节点的最后一个元素
                let i = count - 1;
                // for 循环使得 i 递减
                for (i; i >= 0; i--) {
                    if (source[i] === -1) {
                        // 全新的节点，需要挂载
                        // 该节点在新的 children 中真实的索引位置
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        // 该节点的下一个节点位置
                        const nextPos = pos + 1;
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        // 挂载
                        patch(null, newVNode, container, anchor);
                    } else if (i !== seq[s]) {
                        // 如果节点索引 i 不等于 seq[s] 的值，说明该节点需要移动
                        // 该节点在新的 children 中真实的索引位置
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        // 该节点的下一个节点位置
                        const nextPos = pos + 1;
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        insert(newVNode.el, container, anchor);
                    } else {
                        // 当 i === seq[s] 时说明该位置的节点不需要移动
                        // 只需要让 s 指向下一个位置
                        s--;
                    }
                }
            }
        }
    }

    // 以为书中没有提供该方法
    // 到 github 在 vue.js 3 中找到后又返回接着看书才发现有...
    // 获取最长递增子序列 取自 vue.js 3:
    function getSequence(arr) {
        const p = arr.slice()
        const result = [0]
        let i, j, u, v, c
        const len = arr.length
        for (i = 0; i < len; i++) {
            const arrI = arr[i]
            if (arrI !== 0) {
                j = result[result.length - 1]
                if (arr[j] < arrI) {
                    p[i] = j
                    result.push(i)
                    continue
                }
                u = 0
                v = result.length - 1
                while (u < v) {
                    c = (u + v) >> 1
                    if (arr[result[c]] < arrI) {
                        u = c + 1
                    } else {
                        v = c
                    }
                }
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1]
                    }
                    result[u] = i
                }
            }
        }
        u = result.length
        v = result[u - 1]
        while (u-- > 0) {
            result[u] = v
            v = p[v]
        }
        return result
    }

    function patchComponent(n1, n2, anchor) {
        const instance = (n2.component = n1.component)
        const { props } = instance
        if (hasPropsChanged(n1.props, n2.props)) {
            // 调用 resolveProps 函数重新获取 props 数据
            const [ nextProps ] = resolveProps(n2.type.props, n2.props)
            // 更新 props
            for (const key in nextProps) {
                props[key] = nextProps[key]
                
            }
            // 删除不存在的 props
            for (const k in props) {
                if (!(k in nextProps)) delete props[k]
            }
        }

    }

    function hasPropsChanged(prevProps, nextProps) {
        const nextKeys = Object.keys(nextProps)
        if (nextKeys.length !== Object.keys(prevProps).length) {
            return true
        }
        for (let i = 0; i < nextKeys.length; i++){
            const key = nextKeys[i];
            if (nextProps[key] !== prevProps[key]) return true
        }
        return false
    }

    
    function mountComponent(vnode, container, anchor) {
        const componentOptions = vnode.type
        const { render, data, setup, props: propsOptions, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated } = componentOptions
        // 在这里调用 beforeCreate
        beforeCreate && beforeCreate()
        
        // 调用 data 函数得到原始数据，并调用 reactive 函数将其包装为响应式数据
        const state = data ? reactive(data()) : null

        // 调用 resolveProps 函数解析出最终的 props 和 attrs 数据
        const [props, attrs] = resolveProps(propsOptions, vnode.props)
        
        const slots = vnode.children || {}
        // 组件的实例与组件的声明周期
        // 定义一个组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态信息
        const instance = {
            state,  // 组件的自身状态数据
            isMounted: false,   // 组件是否已经挂载，初始值为 false
            subTree: null,
            // 将解析出的 props 数据包装为 shallowReactive 并定义到组件实例上，暂用 reactive 替代
            props: reactive(props),
            slots,
            mounted: []
        }
        
        function emit(event, ...payload) {
            const eventName = `on${event[0].toUpperCase() + event.slice(1)}`
            console.log(eventName)
            const handler = instance.props[eventName]
            if (handler) {
                handler(...payload)
            } else {
                console.error('事件不存在')
            }
        }

        // setup 的第二个参数
        const setupContext = { attrs, emit, slots }
        // 在调用 setup 函数之前，设置当前组件实例
        setCurrentInstance(instance)
        const setupResult = setup && setup(instance.props, setupContext)
        // 在 setup 函数执行完成之后重置当前实例
        setCurrentInstance(null)
        // 用来存储 setup 返回的数据
        let setupState = null
        if (typeof setupResult === 'function') {
            // 报告冲突
            if (render) console.error('setup 函数返回渲染函数，render选项将被忽略')
            render = setupResult
        } else {
            setupState = setupResult
        }
        
        // 将组件实例设置到 vnode 上，用于后续更新
        vnode.component = instance

        // debugger
        const renderContext = new Proxy(instance, {
            get(t, k, r) {
                const { state, props, slots } = t
                if (k === '$slots') return slots
                if (state && k in state) {
                    return state[k]
                } else if (k in props) {
                    return props[k]
                } else if (setupState && k in setupState) {
                    // 渲染上下文需要对 setup 的支持
                    return setupState[k]
                } else {
                    console.error('不存在')
                }
            },
            set(t, k, v, r) {
                const { state, props } = t
                if (state && k in state) {
                    state[k] = v
                } else if (k in props) {
                    props[k] = v
                } else if (setupResult && k in setupResult) {
                    setupResult[k] = v
                } else {
                    console.log('不存在')
                }
            }
        })
        
        // 在这里调用 created
        created && created.call(renderContext)
        // 调用 render 函数时将其 this 设置为 state
        // 从 render 函数内部可以通过 this 访问组件自身状态数据
        // 将组件的 render 调用函数包装到 effect 内
        effect(() => {
            const subTree = render.call(renderContext, renderContext);
            if (!instance.isMounted) {
                // 在这里调用 beforeMount
                beforeMount && beforeMount.call(renderContext)
                patch(null, subTree, container, anchor);
                // 将组件实例的 isMounted 设置为 true，当更新是不在执行挂载逻辑
                instance.isMounted = true
                // 在这里调用 mounted
                mounted && mounted.call(renderContext)
                instance.mounted && instance.mounted.forEach(hook => hook.call(renderContext))
            } else {
                // 在这里调用 beforeUpdate
                beforeUpdate && beforeUpdate.call(renderContext)
                patch(instance.subTree, subTree, container, anchor);
                // 在这里调用 updated
                updated && updated.call(renderContext)
            }
            // 更新组件实例的子树
            instance.subTree = subTree
        }, {
            scheduler: jobQueue
        })
        
    }

    function resolveProps(options, propsData) {
        const props = {}
        const attrs = {}
        for (const key in propsData) {
            if (key in options || key.startsWith('on')) {
                props[key] = propsData[key]
            } else {
                attrs[key] = propsData[key]
            }
        }
        return [props, attrs]
    }

    const queue = new Set()
    let isFlushing = false
    const p = Promise.resolve()
    function jobQueue(job) {
        queue.add(job)
        if (!isFlushing) {
            isFlushing = true
            p.then(() => {
                try {
                    queue.forEach(fn => fn())
                } finally {
                    isFlushing = false
                    queue.length = 0
                }
            })
        }
    }

    return {
        render
    }
}

function shouldSetAsProps(el, key, value) {
    // 因为 el.form 是只读的，所以需要通过 setAttribute 设置
    if (key === 'form' && el.tagName === 'INPUT') return false;
    // 用 in 操作符判断 key 是否存在对应的 DOM Properties
    return key in el;
}

const renderer = createRenderer({
    createElement(tag){
        return document.createElement(tag);
    },
    setElementText(el, text){
        el.textContent = text;
    },
    insert(el, parent, anchor = null){
        parent.insertBefore(el, anchor);
    },
    createText(text){
        return document.createTextNode(text);
    },
    setText(el, text){
        el.nodeValue = text;
    },
    createComment(text) {
        return document.createComment(text);
    },
    setComment(el, comment){
        el.nodeValue = comment;
    },
    patchProps(el, key, preValue, nextValue){
        // ——————————————事件处理 开始—————————————
        if (/^on/.test(key)) {
            const name = key.slice(2).toLowerCase();
            const invokers = el._vei || ( el._vei = {} );
            let invoker = invokers[key];
            
            if (nextValue) {
                if (!invoker) {
                    invoker = el._vei[key] = (e) => {
                        // 如果事件发生的时间早于事件处理函数绑定的时间，则不执行事件处理函数
                        if (e.timeStamp < invoker.attached) return;
                        if (Array.isArray(invoker.value)) {
                            invoker.value.forEach(fn => fn(e));
                        } else {
                            invoker.value(e);
                        }
                    }
                    invoker.value = nextValue;
                    // 添加 invoker.attached 属性，存储事件处理函数绑定的时间
                    invoker.attached = performance.now();
                    el.addEventListener(name, invoker);
                } else {
                    invoker.value = nextValue;
                }

            } else if (invoker) {
                el.removeEventListener(name, invoker);
            }
        // ——————————————事件处理 结束—————————————
        } else if (key === 'class'){
            // class 的处理
            el.className = nextValue || '';
        } else if (shouldSetAsProps(el, key, nextValue)) {
            // 获取该 DOM 的 Properties 类型
            const type = typeof el[key];
            // 如果是布尔类型，并且 value 是空字符串，则将值纠正为 true
            if (type === 'boolean' && nextValue === '') {
                el[key] = true;
            } else {
                el[key] = nextValue;
            }
        } else {
            // 如果要设置的属性没有对应的 DOM Properties，则使用 setAttribute 函数设置属性
            el.setAttribute(key, nextValue);
        }
    }
});
