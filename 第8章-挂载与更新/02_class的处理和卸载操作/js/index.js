const vnode = {
    type: 'h1',
    props: {
        id: 'hh'
    },
    children: [
        {
            type: 'button',
            children: '提交',
            props: {
                disabled: ''
            }
        }
    ]
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
    patchProps(el, key, preValue, nextValue){
        if (key === 'class'){
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

renderer.render(vnode, document.body);
renderer.render(null, document.body);