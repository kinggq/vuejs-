// 渲染器函数的实现
function createRenderer(options) {
    const {
        createElement,
        setElementText,
        insert,
        patchProps
    } = options;

    function mountElement(vnode, container) {
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
        insert(el, container);
    }

    function patch(n1, n2, container) {
        // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
        if (n1 && n1.type !== n2.type) {
            unmount(n1);
            n1 = null;
        }
        const { type } = n2;
        if (typeof type === 'string') {
            if (!n1) {
                // 如果 n1 不存在表示意味着挂载，调用 mountElement 函数完成挂载
                mountElement(n2, container);
            } else {
                // n1 存在，意味着打补丁
            }
        } else if (typeof type === 'object') {
            // 如果 n2 的 type 是个对象，那就说明是个组件
        } else if (typeof type === 'xxx') {
            // 处理其他类型的 vnode
        }
        
    }

    function render(vnode, container) {
        console.log(vnode);
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
        const parent = vnode.el.parentNode;
        if (parent) parent.removeChild(vnode.el);
    }

    return {
        render
    }
}