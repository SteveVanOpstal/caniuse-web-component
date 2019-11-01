
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
(function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement !== 'undefined') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set() {
                // overridden by instance, if it has props
            }
        };
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }

    /* src\CanIUse.svelte generated by Svelte v3.12.1 */
    const { Object: Object_1 } = globals;

    const file = "src\\CanIUse.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object_1.create(ctx);
    	child_ctx.entry = list[i];
    	return child_ctx;
    }

    // (143:6) {#if hovering}
    function create_if_block_2(ctx) {
    	var p, t0_value = Math.round(ctx.entry.usage * 100) / 100 + "", t0, t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = text(" %");
    			attr_dev(p, "class", "usage");
    			add_location(p, file, 143, 8, 3295);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.entries) && t0_value !== (t0_value = Math.round(ctx.entry.usage * 100) / 100 + "")) {
    				set_data_dev(t0, t0_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_2.name, type: "if", source: "(143:6) {#if hovering}", ctx });
    	return block;
    }

    // (140:2) {#each entries as entry}
    function create_each_block(ctx) {
    	var div, p, t0_value = ctx.entry.name + "", t0, t1, t2_value = ctx.entry.version + "", t2, p_class_value, t3, div_class_value;

    	var if_block = (ctx.hovering) && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block) if_block.c();
    			attr_dev(p, "class", p_class_value = ctx.hovering ? 'hovering' : '');
    			add_location(p, file, 141, 6, 3195);
    			attr_dev(div, "class", div_class_value = "stat " + ctx.entry.stat);
    			add_location(div, file, 140, 4, 3157);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(p, t2);
    			append_dev(div, t3);
    			if (if_block) if_block.m(div, null);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.entries) && t0_value !== (t0_value = ctx.entry.name + "")) {
    				set_data_dev(t0, t0_value);
    			}

    			if ((changed.entries) && t2_value !== (t2_value = ctx.entry.version + "")) {
    				set_data_dev(t2, t2_value);
    			}

    			if ((changed.hovering) && p_class_value !== (p_class_value = ctx.hovering ? 'hovering' : '')) {
    				attr_dev(p, "class", p_class_value);
    			}

    			if (ctx.hovering) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if ((changed.entries) && div_class_value !== (div_class_value = "stat " + ctx.entry.stat)) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			if (if_block) if_block.d();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block.name, type: "each", source: "(140:2) {#each entries as entry}", ctx });
    	return block;
    }

    // (148:2) {#if remaining_count}
    function create_if_block(ctx) {
    	var div, p, t0, t1, p_class_value, t2;

    	var if_block = (ctx.hovering) && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text("+");
    			t1 = text(ctx.remaining_count);
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(p, "class", p_class_value = ctx.hovering ? 'hovering' : '');
    			add_location(p, file, 149, 6, 3447);
    			attr_dev(div, "class", "stat gray");
    			add_location(div, file, 148, 4, 3417);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(div, t2);
    			if (if_block) if_block.m(div, null);
    		},

    		p: function update(changed, ctx) {
    			if (changed.remaining_count) {
    				set_data_dev(t1, ctx.remaining_count);
    			}

    			if ((changed.hovering) && p_class_value !== (p_class_value = ctx.hovering ? 'hovering' : '')) {
    				attr_dev(p, "class", p_class_value);
    			}

    			if (ctx.hovering) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			if (if_block) if_block.d();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block.name, type: "if", source: "(148:2) {#if remaining_count}", ctx });
    	return block;
    }

    // (151:6) {#if hovering}
    function create_if_block_1(ctx) {
    	var p, t0_value = Math.round(ctx.remaining_usage * 100) / 100 + "", t0, t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = text(" %");
    			attr_dev(p, "class", "usage");
    			add_location(p, file, 151, 8, 3537);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.remaining_usage) && t0_value !== (t0_value = Math.round(ctx.remaining_usage * 100) / 100 + "")) {
    				set_data_dev(t0, t0_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_1.name, type: "if", source: "(151:6) {#if hovering}", ctx });
    	return block;
    }

    function create_fragment(ctx) {
    	var div, t, dispose;

    	let each_value = ctx.entries;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	var if_block = (ctx.remaining_count) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			if (if_block) if_block.c();
    			this.c = noop;
    			attr_dev(div, "class", "stats");
    			add_location(div, file, 135, 0, 3019);

    			dispose = [
    				listen_dev(div, "mouseenter", ctx.mouseenter_handler),
    				listen_dev(div, "mouseleave", ctx.mouseleave_handler)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_dev(div, t);
    			if (if_block) if_block.m(div, null);
    		},

    		p: function update(changed, ctx) {
    			if (changed.entries || changed.hovering) {
    				each_value = ctx.entries;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if (ctx.remaining_count) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			destroy_each(each_blocks, detaching);

    			if (if_block) if_block.d();
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    function browserExists(agents, browserId) {
      return !!agents[browserId];
    }

    function browserDisplayName(agents, browserId) {
      return agents[browserId].browser;
    }

    function browserCurrentVersion(agents, browserId) {
      return agents[browserId].current_version;
    }

    function browserUsage(agents, browserId) {
      const all_versions = agents[browserId].usage_global;
      return Object.values(all_versions).reduce((a, b) => a + b, 0);
    }

    function statToValue(stat) {
      switch (stat[0]) {
        case "y":
          return 2;
        case "n":
          return 0;
        default:
          return 1;
      }
    }

    function instance($$self, $$props, $$invalidate) {
    	let { type, browsers } = $$props;

      let hovering = false;
      let entries = [];
      let remaining_count = 0;
      let remaining_usage = 0;

      onMount(async () => {
        const response = await fetch(
          "https://raw.githubusercontent.com/Fyrd/caniuse/master/fulldata-json/data-2.0.json"
        );
        const json = await response.json();
        const data = json.data;
        const agents = json.agents;

        const typeData = data[type];
        if (!typeData) {
          return;
        }

        const stats = typeData.stats;

        let browserIds = [];
        if (!browsers || !browsers.length) {
          browserIds = Object.keys(agents);
        } else {
          browserIds = JSON.parse(browsers.replace(/'/g, '"'));
        }

        $$invalidate('entries', entries = []);
        if (browserIds && browserIds.length) {
          for (const browserId of browserIds) {
            if (!browserExists(agents, browserId)) {
              continue;
            }
            const version = browserCurrentVersion(agents, browserId);
            const name = browserDisplayName(agents, browserId);
            const usage = browserUsage(agents, browserId);
            const stat = stats[browserId][version];
            entries.push({ name, version, stat, usage });
          }
        }

        $$invalidate('entries', entries = entries.sort((entryA, entryB) => {
          const valueA = statToValue(entryA.stat);
          const valueB = statToValue(entryB.stat);
          if (valueA === valueB) {
            return entryA.usage < entryB.usage ? 1 : -1;
          }
          return valueA < valueB ? 1 : -1;
        }));

        $$invalidate('remaining_count', remaining_count = Object.keys(agents).length - browserIds.length);

        const remainingBrowsers = Object.keys(agents).filter(
          a => browsers.indexOf(a) < 0
        );
        $$invalidate('remaining_usage', remaining_usage = 0);
        for (const browserId of remainingBrowsers) {
          $$invalidate('remaining_usage', remaining_usage += browserUsage(agents, browserId));
        }
      });

    	const writable_props = ['type', 'browsers'];
    	Object_1.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<> was created with unknown prop '${key}'`);
    	});

    	const mouseenter_handler = () => ($$invalidate('hovering', hovering = true));

    	const mouseleave_handler = () => ($$invalidate('hovering', hovering = false));

    	$$self.$set = $$props => {
    		if ('type' in $$props) $$invalidate('type', type = $$props.type);
    		if ('browsers' in $$props) $$invalidate('browsers', browsers = $$props.browsers);
    	};

    	$$self.$capture_state = () => {
    		return { type, browsers, hovering, entries, remaining_count, remaining_usage };
    	};

    	$$self.$inject_state = $$props => {
    		if ('type' in $$props) $$invalidate('type', type = $$props.type);
    		if ('browsers' in $$props) $$invalidate('browsers', browsers = $$props.browsers);
    		if ('hovering' in $$props) $$invalidate('hovering', hovering = $$props.hovering);
    		if ('entries' in $$props) $$invalidate('entries', entries = $$props.entries);
    		if ('remaining_count' in $$props) $$invalidate('remaining_count', remaining_count = $$props.remaining_count);
    		if ('remaining_usage' in $$props) $$invalidate('remaining_usage', remaining_usage = $$props.remaining_usage);
    	};

    	return {
    		type,
    		browsers,
    		hovering,
    		entries,
    		remaining_count,
    		remaining_usage,
    		mouseenter_handler,
    		mouseleave_handler
    	};
    }

    class CanIUse extends SvelteElement {
    	constructor(options) {
    		super();

    		this.shadowRoot.innerHTML = `<style>.stats{display:flex}.stat{display:flex;justify-content:center;align-items:center;height:30px;color:white;background-color:#a8bd04;margin:0.25rem;padding:0.25rem 1rem;border-radius:10px}.stat.y{background-color:#39b54a}.stat.n{background-color:#c44230}.stat.gray{background-color:gray}.stat .hovering{color:transparent}.stat .usage{position:absolute;margin:0rem}
		/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2FuSVVzZS5zdmVsdGUiLCJzb3VyY2VzIjpbIkNhbklVc2Uuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IG9uTW91bnQgfSBmcm9tIFwic3ZlbHRlXCI7XG4gIGV4cG9ydCBsZXQgdHlwZTtcbiAgZXhwb3J0IGxldCBicm93c2VycztcblxuICBsZXQgaG92ZXJpbmcgPSBmYWxzZTtcbiAgbGV0IGVudHJpZXMgPSBbXTtcbiAgbGV0IHJlbWFpbmluZ19jb3VudCA9IDA7XG4gIGxldCByZW1haW5pbmdfdXNhZ2UgPSAwO1xuXG4gIGZ1bmN0aW9uIGJyb3dzZXJFeGlzdHMoYWdlbnRzLCBicm93c2VySWQpIHtcbiAgICByZXR1cm4gISFhZ2VudHNbYnJvd3NlcklkXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJyb3dzZXJEaXNwbGF5TmFtZShhZ2VudHMsIGJyb3dzZXJJZCkge1xuICAgIHJldHVybiBhZ2VudHNbYnJvd3NlcklkXS5icm93c2VyO1xuICB9XG5cbiAgZnVuY3Rpb24gYnJvd3NlckN1cnJlbnRWZXJzaW9uKGFnZW50cywgYnJvd3NlcklkKSB7XG4gICAgcmV0dXJuIGFnZW50c1ticm93c2VySWRdLmN1cnJlbnRfdmVyc2lvbjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJyb3dzZXJVc2FnZShhZ2VudHMsIGJyb3dzZXJJZCkge1xuICAgIGNvbnN0IGFsbF92ZXJzaW9ucyA9IGFnZW50c1ticm93c2VySWRdLnVzYWdlX2dsb2JhbDtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhhbGxfdmVyc2lvbnMpLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApO1xuICB9XG5cbiAgZnVuY3Rpb24gc3RhdFRvVmFsdWUoc3RhdCkge1xuICAgIHN3aXRjaCAoc3RhdFswXSkge1xuICAgICAgY2FzZSBcInlcIjpcbiAgICAgICAgcmV0dXJuIDI7XG4gICAgICBjYXNlIFwiblwiOlxuICAgICAgICByZXR1cm4gMDtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAxO1xuICAgIH1cbiAgfVxuXG4gIG9uTW91bnQoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICBcImh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9GeXJkL2Nhbml1c2UvbWFzdGVyL2Z1bGxkYXRhLWpzb24vZGF0YS0yLjAuanNvblwiXG4gICAgKTtcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIGNvbnN0IGRhdGEgPSBqc29uLmRhdGE7XG4gICAgY29uc3QgYWdlbnRzID0ganNvbi5hZ2VudHM7XG5cbiAgICBjb25zdCB0eXBlRGF0YSA9IGRhdGFbdHlwZV07XG4gICAgaWYgKCF0eXBlRGF0YSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXRzID0gdHlwZURhdGEuc3RhdHM7XG5cbiAgICBsZXQgYnJvd3NlcklkcyA9IFtdO1xuICAgIGlmICghYnJvd3NlcnMgfHwgIWJyb3dzZXJzLmxlbmd0aCkge1xuICAgICAgYnJvd3NlcklkcyA9IE9iamVjdC5rZXlzKGFnZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyb3dzZXJJZHMgPSBKU09OLnBhcnNlKGJyb3dzZXJzLnJlcGxhY2UoLycvZywgJ1wiJykpO1xuICAgIH1cblxuICAgIGVudHJpZXMgPSBbXTtcbiAgICBpZiAoYnJvd3NlcklkcyAmJiBicm93c2VySWRzLmxlbmd0aCkge1xuICAgICAgZm9yIChjb25zdCBicm93c2VySWQgb2YgYnJvd3Nlcklkcykge1xuICAgICAgICBpZiAoIWJyb3dzZXJFeGlzdHMoYWdlbnRzLCBicm93c2VySWQpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdmVyc2lvbiA9IGJyb3dzZXJDdXJyZW50VmVyc2lvbihhZ2VudHMsIGJyb3dzZXJJZCk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBicm93c2VyRGlzcGxheU5hbWUoYWdlbnRzLCBicm93c2VySWQpO1xuICAgICAgICBjb25zdCB1c2FnZSA9IGJyb3dzZXJVc2FnZShhZ2VudHMsIGJyb3dzZXJJZCk7XG4gICAgICAgIGNvbnN0IHN0YXQgPSBzdGF0c1ticm93c2VySWRdW3ZlcnNpb25dO1xuICAgICAgICBlbnRyaWVzLnB1c2goeyBuYW1lLCB2ZXJzaW9uLCBzdGF0LCB1c2FnZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBlbnRyaWVzID0gZW50cmllcy5zb3J0KChlbnRyeUEsIGVudHJ5QikgPT4ge1xuICAgICAgY29uc3QgdmFsdWVBID0gc3RhdFRvVmFsdWUoZW50cnlBLnN0YXQpO1xuICAgICAgY29uc3QgdmFsdWVCID0gc3RhdFRvVmFsdWUoZW50cnlCLnN0YXQpO1xuICAgICAgaWYgKHZhbHVlQSA9PT0gdmFsdWVCKSB7XG4gICAgICAgIHJldHVybiBlbnRyeUEudXNhZ2UgPCBlbnRyeUIudXNhZ2UgPyAxIDogLTE7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWVBIDwgdmFsdWVCID8gMSA6IC0xO1xuICAgIH0pO1xuXG4gICAgcmVtYWluaW5nX2NvdW50ID0gT2JqZWN0LmtleXMoYWdlbnRzKS5sZW5ndGggLSBicm93c2VySWRzLmxlbmd0aDtcblxuICAgIGNvbnN0IHJlbWFpbmluZ0Jyb3dzZXJzID0gT2JqZWN0LmtleXMoYWdlbnRzKS5maWx0ZXIoXG4gICAgICBhID0+IGJyb3dzZXJzLmluZGV4T2YoYSkgPCAwXG4gICAgKTtcbiAgICByZW1haW5pbmdfdXNhZ2UgPSAwO1xuICAgIGZvciAoY29uc3QgYnJvd3NlcklkIG9mIHJlbWFpbmluZ0Jyb3dzZXJzKSB7XG4gICAgICByZW1haW5pbmdfdXNhZ2UgKz0gYnJvd3NlclVzYWdlKGFnZW50cywgYnJvd3NlcklkKTtcbiAgICB9XG4gIH0pO1xuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgLnN0YXRzIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICB9XG5cbiAgLnN0YXQge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICBoZWlnaHQ6IDMwcHg7XG4gICAgY29sb3I6IHdoaXRlO1xuICAgIGJhY2tncm91bmQtY29sb3I6ICNhOGJkMDQ7XG4gICAgbWFyZ2luOiAwLjI1cmVtO1xuICAgIHBhZGRpbmc6IDAuMjVyZW0gMXJlbTtcbiAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICB9XG5cbiAgLnN0YXQueSB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzM5YjU0YTtcbiAgfVxuXG4gIC5zdGF0Lm4ge1xuICAgIGJhY2tncm91bmQtY29sb3I6ICNjNDQyMzA7XG4gIH1cblxuICAuc3RhdC5ncmF5IHtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiBncmF5O1xuICB9XG5cbiAgLnN0YXQgLmhvdmVyaW5nIHtcbiAgICBjb2xvcjogdHJhbnNwYXJlbnQ7XG4gIH1cblxuICAuc3RhdCAudXNhZ2Uge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBtYXJnaW46IDByZW07XG4gIH1cbjwvc3R5bGU+XG5cbjxzdmVsdGU6b3B0aW9ucyB0YWc9e251bGx9IC8+XG48ZGl2XG4gIGNsYXNzPVwic3RhdHNcIlxuICBvbjptb3VzZWVudGVyPXsoKSA9PiAoaG92ZXJpbmcgPSB0cnVlKX1cbiAgb246bW91c2VsZWF2ZT17KCkgPT4gKGhvdmVyaW5nID0gZmFsc2UpfT5cbiAgeyNlYWNoIGVudHJpZXMgYXMgZW50cnl9XG4gICAgPGRpdiBjbGFzcz1cInN0YXQge2VudHJ5LnN0YXR9XCI+XG4gICAgICA8cCBjbGFzcz17aG92ZXJpbmcgPyAnaG92ZXJpbmcnIDogJyd9PntlbnRyeS5uYW1lfSB7ZW50cnkudmVyc2lvbn08L3A+XG4gICAgICB7I2lmIGhvdmVyaW5nfVxuICAgICAgICA8cCBjbGFzcz1cInVzYWdlXCI+e01hdGgucm91bmQoZW50cnkudXNhZ2UgKiAxMDApIC8gMTAwfSAlPC9wPlxuICAgICAgey9pZn1cbiAgICA8L2Rpdj5cbiAgey9lYWNofVxuICB7I2lmIHJlbWFpbmluZ19jb3VudH1cbiAgICA8ZGl2IGNsYXNzPVwic3RhdCBncmF5XCI+XG4gICAgICA8cCBjbGFzcz17aG92ZXJpbmcgPyAnaG92ZXJpbmcnIDogJyd9Pit7cmVtYWluaW5nX2NvdW50fTwvcD5cbiAgICAgIHsjaWYgaG92ZXJpbmd9XG4gICAgICAgIDxwIGNsYXNzPVwidXNhZ2VcIj57TWF0aC5yb3VuZChyZW1haW5pbmdfdXNhZ2UgKiAxMDApIC8gMTAwfSAlPC9wPlxuICAgICAgey9pZn1cbiAgICA8L2Rpdj5cbiAgey9pZn1cbjwvZGl2PlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWdHRSxNQUFNLEFBQUMsQ0FBQyxBQUNOLE9BQU8sQ0FBRSxJQUFJLEFBQ2YsQ0FBQyxBQUVELEtBQUssQUFBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FDYixlQUFlLENBQUUsTUFBTSxDQUN2QixXQUFXLENBQUUsTUFBTSxDQUNuQixNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxLQUFLLENBQ1osZ0JBQWdCLENBQUUsT0FBTyxDQUN6QixNQUFNLENBQUUsT0FBTyxDQUNmLE9BQU8sQ0FBRSxPQUFPLENBQUMsSUFBSSxDQUNyQixhQUFhLENBQUUsSUFBSSxBQUNyQixDQUFDLEFBRUQsS0FBSyxFQUFFLEFBQUMsQ0FBQyxBQUNQLGdCQUFnQixDQUFFLE9BQU8sQUFDM0IsQ0FBQyxBQUVELEtBQUssRUFBRSxBQUFDLENBQUMsQUFDUCxnQkFBZ0IsQ0FBRSxPQUFPLEFBQzNCLENBQUMsQUFFRCxLQUFLLEtBQUssQUFBQyxDQUFDLEFBQ1YsZ0JBQWdCLENBQUUsSUFBSSxBQUN4QixDQUFDLEFBRUQsS0FBSyxDQUFDLFNBQVMsQUFBQyxDQUFDLEFBQ2YsS0FBSyxDQUFFLFdBQVcsQUFDcEIsQ0FBQyxBQUVELEtBQUssQ0FBQyxNQUFNLEFBQUMsQ0FBQyxBQUNaLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLE1BQU0sQ0FBRSxJQUFJLEFBQ2QsQ0FBQyJ9 */</style>`;

    		init(this, { target: this.shadowRoot }, instance, create_fragment, safe_not_equal, ["type", "browsers"]);

    		const { ctx } = this.$$;
    		const props = this.attributes;
    		if (ctx.type === undefined && !('type' in props)) {
    			console.warn("<> was created without expected prop 'type'");
    		}
    		if (ctx.browsers === undefined && !('browsers' in props)) {
    			console.warn("<> was created without expected prop 'browsers'");
    		}

    		if (options) {
    			if (options.target) {
    				insert_dev(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return ["type","browsers"];
    	}

    	get type() {
    		return this.$$.ctx.type;
    	}

    	set type(type) {
    		this.$set({ type });
    		flush();
    	}

    	get browsers() {
    		return this.$$.ctx.browsers;
    	}

    	set browsers(browsers) {
    		this.$set({ browsers });
    		flush();
    	}
    }

    /* src\CanIUseTotal.svelte generated by Svelte v3.12.1 */

    const file$1 = "src\\CanIUseTotal.svelte";

    function create_fragment$1(ctx) {
    	var p, span0, t0, t1, t2, span1, t3, t4, t5, t6_value = ctx.full + ctx.partial + "", t6, t7;

    	const block = {
    		c: function create() {
    			p = element("p");
    			span0 = element("span");
    			t0 = text(ctx.full);
    			t1 = text("%");
    			t2 = text("\r\n  +\r\n  ");
    			span1 = element("span");
    			t3 = text(ctx.partial);
    			t4 = text("%");
    			t5 = text("\r\n  = ");
    			t6 = text(t6_value);
    			t7 = text("%");
    			this.c = noop;
    			attr_dev(span0, "class", "y");
    			add_location(span0, file$1, 36, 2, 641);
    			attr_dev(span1, "class", "p");
    			add_location(span1, file$1, 38, 2, 680);
    			add_location(p, file$1, 35, 0, 634);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, span0);
    			append_dev(span0, t0);
    			append_dev(span0, t1);
    			append_dev(p, t2);
    			append_dev(p, span1);
    			append_dev(span1, t3);
    			append_dev(span1, t4);
    			append_dev(p, t5);
    			append_dev(p, t6);
    			append_dev(p, t7);
    		},

    		p: function update(changed, ctx) {
    			if (changed.full) {
    				set_data_dev(t0, ctx.full);
    			}

    			if (changed.partial) {
    				set_data_dev(t3, ctx.partial);
    			}

    			if ((changed.full || changed.partial) && t6_value !== (t6_value = ctx.full + ctx.partial + "")) {
    				set_data_dev(t6, t6_value);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { type } = $$props;

      let full = 0;
      let partial = 0;

      onMount(async () => {
        const response = await fetch(
          "https://raw.githubusercontent.com/Fyrd/caniuse/master/fulldata-json/data-2.0.json"
        );
        const json = await response.json();
        const data = json.data;

        const typeData = data[type];
        if (!typeData) {
          return;
        }

        $$invalidate('full', full = typeData.usage_perc_y);
        $$invalidate('partial', partial = typeData.usage_perc_a);
      });

    	const writable_props = ['type'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('type' in $$props) $$invalidate('type', type = $$props.type);
    	};

    	$$self.$capture_state = () => {
    		return { type, full, partial };
    	};

    	$$self.$inject_state = $$props => {
    		if ('type' in $$props) $$invalidate('type', type = $$props.type);
    		if ('full' in $$props) $$invalidate('full', full = $$props.full);
    		if ('partial' in $$props) $$invalidate('partial', partial = $$props.partial);
    	};

    	return { type, full, partial };
    }

    class CanIUseTotal extends SvelteElement {
    	constructor(options) {
    		super();

    		this.shadowRoot.innerHTML = `<style>.y{color:#39b54a}.p{color:#a8bd04}
		/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2FuSVVzZVRvdGFsLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQ2FuSVVzZVRvdGFsLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gIGltcG9ydCB7IG9uTW91bnQgfSBmcm9tIFwic3ZlbHRlXCI7XHJcbiAgZXhwb3J0IGxldCB0eXBlO1xyXG5cclxuICBsZXQgZnVsbCA9IDA7XHJcbiAgbGV0IHBhcnRpYWwgPSAwO1xyXG5cclxuICBvbk1vdW50KGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXHJcbiAgICAgIFwiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0Z5cmQvY2FuaXVzZS9tYXN0ZXIvZnVsbGRhdGEtanNvbi9kYXRhLTIuMC5qc29uXCJcclxuICAgICk7XHJcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xyXG4gICAgY29uc3QgZGF0YSA9IGpzb24uZGF0YTtcclxuXHJcbiAgICBjb25zdCB0eXBlRGF0YSA9IGRhdGFbdHlwZV07XHJcbiAgICBpZiAoIXR5cGVEYXRhKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBmdWxsID0gdHlwZURhdGEudXNhZ2VfcGVyY195O1xyXG4gICAgcGFydGlhbCA9IHR5cGVEYXRhLnVzYWdlX3BlcmNfYTtcclxuICB9KTtcclxuPC9zY3JpcHQ+XHJcblxyXG48c3R5bGU+XHJcbiAgLnkge1xyXG4gICAgY29sb3I6ICMzOWI1NGE7XHJcbiAgfVxyXG5cclxuICAucCB7XHJcbiAgICBjb2xvcjogI2E4YmQwNDtcclxuICB9XHJcbjwvc3R5bGU+XHJcblxyXG48c3ZlbHRlOm9wdGlvbnMgdGFnPXtudWxsfSAvPlxyXG48cD5cclxuICA8c3BhbiBjbGFzcz1cInlcIj57ZnVsbH0lPC9zcGFuPlxyXG4gICtcclxuICA8c3BhbiBjbGFzcz1cInBcIj57cGFydGlhbH0lPC9zcGFuPlxyXG4gID0ge2Z1bGwgKyBwYXJ0aWFsfSVcclxuPC9wPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBeUJFLEVBQUUsQUFBQyxDQUFDLEFBQ0YsS0FBSyxDQUFFLE9BQU8sQUFDaEIsQ0FBQyxBQUVELEVBQUUsQUFBQyxDQUFDLEFBQ0YsS0FBSyxDQUFFLE9BQU8sQUFDaEIsQ0FBQyJ9 */</style>`;

    		init(this, { target: this.shadowRoot }, instance$1, create_fragment$1, safe_not_equal, ["type"]);

    		const { ctx } = this.$$;
    		const props = this.attributes;
    		if (ctx.type === undefined && !('type' in props)) {
    			console.warn("<> was created without expected prop 'type'");
    		}

    		if (options) {
    			if (options.target) {
    				insert_dev(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return ["type"];
    	}

    	get type() {
    		return this.$$.ctx.type;
    	}

    	set type(type) {
    		this.$set({ type });
    		flush();
    	}
    }

    customElements.define("can-i-use", CanIUse);

    customElements.define("can-i-use-total", CanIUseTotal);

}());
//# sourceMappingURL=can-i-use.js.map
