// 渲染器函数的实现
const Text = Symbol();
const Comment = Symbol();
const Fragment = Symbol();
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

    // 双端 Diff 算法的原理
    function patchKeyeChildren(n1, n2, container) {
        const oldChildren = n1.children;
        const newChildren = n2.children;

        // 四个索引值
        let oldStartIdx = 0;
        let oldEndIdx = oldChildren.length - 1;
        let newStartIdx = 0;
        let newEndIdx = newChildren.length - 1;

        // 一个索引值指向的 vnode
        let oldStartVNode = oldChildren[oldStartIdx];
        let oldEndVNode = oldChildren[oldEndIdx];
        let newStartVNode = newChildren[newStartIdx];
        let newEndVNode = newChildren[newEndIdx];

        while(oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (!oldStartVNode) {
                oldStartVNode = oldChildren[++oldStartIdx];
            } else if (!oldEndVNode) {
                // 书中是这样写的 oldEndVNode = newChildren[--oldEndIdx]; 没太明白为啥这么写
                oldEndVNode = oldChildren[--oldEndIdx];
            } else if (oldStartVNode.key === newStartVNode.key) {
                // 都是头部，不需要移动，只需要打补丁即可
                patch(oldStartVNode, newStartVNode, container);
                oldStartVNode = oldChildren[++oldStartIdx];
                newStartVNode = newChildren[++newStartIdx];
            } else if (oldEndVNode.key === newEndVNode.key) {
                // 因两者都在尾部节点，所以不需要移动，只需要补丁
                patch(oldEndVNode, newEndVNode, container);
                oldEndVNode = oldChildren[--oldEndIdx];
                newEndVNode = newChildren[--newEndIdx];
            } else if (oldStartVNode.key === newEndVNode.key) {
                patch(oldStartVNode, newEndVNode, container);
                insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
                oldStartVNode = oldChildren[++oldStartIdx];
                newEndVNode = newChildren[--newEndIdx];
            } else if (oldEndVNode.key === newStartVNode.key) {
                // 仍然需要调用 patch 函数补丁
                patch(oldEndVNode, newStartVNode, container);
                insert(oldEndVNode.el, container, oldStartVNode.el);

                oldEndVNode = oldChildren[--oldEndIdx];
                newStartVNode = newChildren[++newStartIdx];
            } else {
                const idxInOld = oldChildren.findIndex(
                    node => node && node.key === newStartVNode.key
                );
                if (idxInOld > 0) {
                    const vnodeToMove = oldChildren[idxInOld];
                    patch(vnodeToMove, newStartVNode, container);
                    insert(vnodeToMove.el, container, oldStartVNode.el);
                    oldChildren[idxInOld] = undefined;
                } else {
                    patch(null, newStartVNode, container, oldStartVNode.el);
                }
                newStartVNode = newChildren[++newStartIdx];
            }
        }
        // while 循环结束后检查索引的情况，不然会遗漏新增元素
        if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
            // 如果满足条件则说明有新的节点遗漏，需要挂载衙门
            
            for (let i = newStartIdx; i <= newEndIdx; i++) {
                const anchorIndex = i + 1;
                // 书中没有完善此处
                const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
                patch(null, newChildren[i], container, anchor);
            }
        } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
            // 移除不存在的元素，思路跟新增元素类似
            for (let i = oldStartIdx; i <=  oldEndIdx; i++) {
                unmount(oldChildren[i]);
            }
        }
    }

    return {
        render
    }
}