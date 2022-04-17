const vnode = {
    type: 'h1',
    children: 'hello'
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
    }
});

renderer.render(vnode, document.body);
renderer.render(vnode, document.body);
renderer.render(null, document.body);