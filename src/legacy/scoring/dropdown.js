export const dd = (function () {
  let fx = {};

  function findUpClass(elem, class_name) {
    let depth = 1;
    if (Array.from(elem.classList).indexOf(class_name) >= 0) return { elem, depth };
    while (elem.parentNode) {
      elem = elem.parentNode;
      if (elem.classList && Array.from(elem.classList).indexOf(class_name) >= 0) return { elem, depth };
      depth += 1;
    }
    return { elem: null, depth: 0 };
  }

  const SPAN_FIRST_OF_TYPE = 'span:first-of-type';
  fx.DropDown = DropDown;
  function DropDown({ element, onChange, css_class, id, locked, max, maxFx, value_attribute = true, background }) {
    if (!element && id) element = document.getElementById(id);

    this.id = id;
    this.val = '';
    this.max = max;
    this.maxFx = maxFx;
    this.el = element;
    this.locked = locked;
    this.background = background || '';
    this.bordercolor = '';
    this.labelcolor = '#000';
    this.class = css_class;
    this.value_attribute = value_attribute;
    this.list = this.el?.querySelector('.dd_state');
    this.options = this.el?.querySelector('.options');
    this.label = this.el?.querySelector('div:first-of-type');
    this.opts = this.list?.querySelectorAll('li') || [];
    this.selection = this.list?.querySelector(SPAN_FIRST_OF_TYPE) || undefined;

    if (typeof onChange === 'function') this.onChange = onChange;
    this.initEvents();
  }

  function addClick(obj) {
    if (!obj.el) {
      // console.log('missing element', { obj });
      return;
    }
    if (!obj.el.ddclick) {
      obj.el.ddclick = true;
      obj.el.addEventListener('click', (e) => {
        if (obj.locked) return;

        // determine click position relative to ddlb elements
        let { elem: dd_state, depth: dd_state_depth } = findUpClass(e.target, 'dd_state');
        let { elem: option, depth: option_depth } = findUpClass(e.target, 'dd_option');

        let actv = dd_state && Array.from(dd_state.classList).indexOf('active') >= 0;

        if (
          obj.max &&
          !option &&
          obj.opts &&
          obj.opts.length > obj.max &&
          obj.maxFx &&
          typeof obj.maxFx === 'function'
        ) {
          obj.maxFx(obj.options);
          return;
        }

        fx.closeAllDropDowns(obj.class);

        // active ddlb if option not found or dd_state found before option
        if (dd_state && (!option_depth || dd_state_depth < option_depth))
          dd_state.classList[actv ? 'remove' : 'add']('active');

        // prevent the click from propagating to the document
        e.stopPropagation();
      });
    }
  }

  function addOptClicks(obj) {
    Array.from(obj.opts).forEach((opt) => {
      opt.addEventListener('click', () => {
        obj.list.classList.remove('active');
        let key = opt.querySelector(SPAN_FIRST_OF_TYPE);
        let value = key.getAttribute('value');
        obj.selection.innerHTML = key.innerHTML;
        // eslint-disable-next-line
        let changed = obj.val != value;
        obj.val = value;
        if (changed && obj.onChange) {
          obj.onChange(value);
          obj.selectionBackground();
          obj.labelColor();
        }
      });
    });
  }

  function optionHTML(option, style) {
    return `<li class='dd_option' title='${option.title || ''}'><span value="${option.value}" style="${style || ''}">${
      option.key
    }</span></li>`;
  }

  DropDown.prototype = {
    initEvents() {
      let obj = this;
      // obj.el.style.display = 'flex';
      addClick(obj);
      addOptClicks(obj);
    },
    getLabel() {
      return this.selection.innerHTML;
    },
    getValue() {
      return this.val;
    },
    setId(id) {
      this.id = id;
    },
    getId() {
      return this.id;
    },
    lock() {
      this.locked = true;
    },
    unlock() {
      this.locked = false;
    },
    setOptions(options, style = '') {
      if (!Array.isArray(options) || !options.length || !this.list) return;
      let list = this.list.querySelector('ul');
      if (!list) return;
      if (this.max && options && options.length > this.max) {
        fx.closeAllDropDowns(this.class);
      }
      list.innerHTML = options.map((option) => optionHTML(option, style)).join('');
      this.options = options;
      this.opts = this.list.querySelectorAll('li');
      addOptClicks(this);
      return this;
    },
    getOptions() {
      return Array.from(this.opts).map((o) => {
        let e = o.querySelector(SPAN_FIRST_OF_TYPE);
        return { key: e.innerHTML, value: e.getAttribute('value') };
      });
    },
    setLabel(html, background, color, border) {
      if (this.selection) {
        this.selection.innerHTML = html;
        this.selectionBackground(background);
        this.labelColor(color);
        this.borderColor(border);
      }
    },
    setValue(value, background, color, border) {
      let options = Array.from(this.opts).filter((o) => {
        let attribute_value = o.querySelector(SPAN_FIRST_OF_TYPE).getAttribute('value');
        // eslint-disable-next-line
        return attribute_value == value;
      });
      let html = options.length ? options[0].querySelector('span').innerHTML : value;
      this.val = value;
      if (this.selection) {
        this.selection.innerHTML = html;
        this.selectionBackground(background);
        this.labelColor(color);
        this.borderColor(border);
      }
    },
    selectionBackground(background) {
      if (!this.selection) return;
      if (background) this.background = background;

      if (this.background) {
        this.selection.classList.remove('novalue');
        this.selection.classList.remove('hasvalue');
        this.selection.style.background = this.background;
      } else if (this.locked) {
        if (this.value_attribute) this.selection.classList.add('hasvalue');
        this.selection.classList.remove('novalue');
      } else if (this.val) {
        this.selection.style.background = '';
        if (this.value_attribute) this.selection.classList.add('hasvalue');
        this.selection.classList.remove('novalue');
      } else {
        this.selection.style.background = '';
        this.selection.classList.add('novalue');
        this.selection.classList.remove('hasvalue');
      }
    },
    labelColor(color) {
      if (color) this.labelcolor = color;
      this.label.style.color = this.labelcolor;
    },
    borderColor(color) {
      if (color) this.bordercolor = color;
      if (this.bordercolor && this.options?.style)
        this.options.style.border = `1px solid ${this.bordercolor}`;
    }
  };

  let dropDownHTML = (label, options = [], selected, border = true, style, floatleft) => {
    let selected_option = selected !== undefined && options[selected] ? options[selected].key : '';
    let options_style = border ? "style='border: 1px solid #000;'" : '';
    let options_html = options.map((option) => optionHTML(option, style)).join('');

    return `
         <div class='dd-label'>${label}</div>
         <div class='options' ${options_style}>
            <ul>
               <li class='dd_state'>
                  <span class='active'>${selected_option}</span>
                  <div>
                     <ul class='${floatleft ? 'floatleft' : ''}'>
                     ${options_html}
                     </ul>
                  </div>
               </li>
            </ul>
         </div>`;
  };

  fx.attachDropDown = ({
    element,
    id,
    label = '',
    options,
    selected = 0,
    css_class,
    border,
    style,
    floatleft,
    display = 'flex'
  }) => {
    if (!id && !element) return;
    // elements will not be visible until new DropDown()
    element = element || document.getElementById(id);
    if (!element) {
      // console.log('invalid element id:', id);
      return;
    }
    element.style.display = display;
    element.classList.add(css_class || 'dd');
    element.innerHTML = dropDownHTML(label, options, selected, border, style, floatleft);
  };

  fx.closeAllDropDowns = () => {
    let elems = document.querySelectorAll('li.dd_state.active');
    Array.from(elems).forEach((elem) => {
      elem.classList.remove('active');
    });
  };

  document.addEventListener('click', () => fx.closeAllDropDowns());

  return fx;
})();
