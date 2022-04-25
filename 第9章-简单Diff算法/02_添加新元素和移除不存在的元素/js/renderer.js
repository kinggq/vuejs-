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
            if (Array.isArray(n1.children)) {
                // diff算法, 因还未到 diff 算法章节，暂时用傻瓜式方法，旧节点全部卸载后挂载新节点
                // n1.children.forEach(c => unmount(c));
                // n2.children.forEach(c => patch(null, c, container));
                // 开始简单的diff算法
                // 1.0 减少DOM操作的性能开销
                /* const oldChildren = n1.children;
                const newChildren = n2.children;
                const oldLen = oldChildren.length;
                const newLen = newChildren.length;
                // 两组节点的公共长度，即两组节点的较短的那组子节点的长度
                const commonLen = Math.min(oldLen, newLen);
                // 遍历 commonLen 次
                for (let i = 0; i < commonLen; i++) {
                    patch(oldChildren[i], newChildren[i]);
                }

                if (newLen > oldLen) {
                    // 如果新子节点长度大于久子节点长度，则说明新子节点需要挂载
                    for (let i = commonLen; i < newLen; i++) {
                        path(null, newChildren[i]);
                    }
                } else if (oldLen > newLen) {
                    // 如果久子节点长度大于新子节点长度，则说明有久子节点需要卸载
                    for (let i = commonLen; i < oldLen; i++) {
                        unmount(oldChildren[i]);
                    }
                } */
                const newChildren = n2.children;
                const oldChildren = n1.children;
                let lastIndex = 0;
                for (let i = 0; i < newChildren.length; i++) {
                    const newVNode = newChildren[i];
                    let j = 0;
                    let find = false;
                    for (j; j < oldChildren.length; j++) {
                        const oldVNode = oldChildren[j];
                        if (oldVNode.key === newVNode.key) {
                            find = true;
                            patch(oldVNode, newVNode, container);
                            if (j < lastIndex) {
                                // 如果当前找到的节点在旧 children 中索引小于最大索引值 lastIndex 
                                // 说明该节点对应的真实 DOM 需要移动
                                const preVNode = newChildren[i - 1];
                                if (preVNode) {
                                    const anchor = preVNode.el.nextSibling;
                                    insert(newVNode.el, container, anchor);
                                }
                            } else {
                                // 如果当前找到的节点在旧 children 中索引不小于最大索引值
                                // 则更新 lastIndex 的值
                                lastIndex = j;
                            }
                            break;
                        }

                    }
                    // 代码执行到这里 find 仍然为 false 
                    // 说明当前 newVNode 没有在旧的一组节点中找到可复用的节点
                    // 也就是说当前 newVNode 是新增节点，需要挂载
                    if (!find) {
                        const preVNode = newChildren[i - 1];
                        let anchor = null;
                        if (preVNode) {
                            anchor = preVNode.el.nextSibling;
                        } else {
                            anchor = container.firstChild;
                        }

                        patch(null, newVNode, container, anchor);
                    }
                }

                // 移除不存在的元素
                for (let i = 0; i < oldChildren.length; i++) {
                    const oldVNode = oldChildren[i];
                    const has = newChildren.find(
                        vnode => vnode.key === oldVNode.key
                    );
                    if (!has) {
                        unmount(oldVNode);
                    }
                }
            } else {
                setElementText(container, '');
                n2.children.forEach(c => patch(null, c, container));
            }

        } else {
            // 代码运行到这里，说明新子节点不存在
            if (Array.isArray(n1.children)) {
                n1.children.forEach(c => unmount(c));
            } else {
                setElementText(container, '');
            }
        }
    }

    return {
        render
    }
}