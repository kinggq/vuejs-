// 渲染器函数的实现
function createRenderer(options) {
    const {
        createElement,
        setElementText,
        insert,
        patchProps
    } = options;

    function mountElement(vnode, container) {
        const el = createElement(vnode.type);

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
        // 如果 n1 不存在表示意味着挂载，调用 mountElement 函数完成挂载
        if (!n1) {
            mountElement(n2, container);
        } else {
            // n1 存在，意味着打补丁
        }
    }

    function render(vnode, container) {
        console.log(vnode);
        if (vnode) {
            patch(container._vnode, vnode, container);
        } else {
            if (container._vnode) {
                document.body.innerHTML = '';
            }
        }
        container._vnode = vnode;
    }

    return {
        render
    }
}