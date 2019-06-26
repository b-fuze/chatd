var app = (function (io) {
    'use strict';

    io = io && io.hasOwnProperty('default') ? io['default'] : io;

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
    function validate_store(store, name) {
        if (!store || typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(component, store, callback) {
        const unsub = store.subscribe(callback);
        component.$$.on_destroy.push(unsub.unsubscribe
            ? () => unsub.unsubscribe()
            : unsub);
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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
    function afterUpdate(fn) {
        get_current_component().$$.after_render.push(fn);
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_binding_callback(fn) {
        binding_callbacks.push(fn);
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
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.callbacks.push(() => {
                outroing.delete(block);
                if (callback) {
                    block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
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
        after_render.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            if (detaching)
                component.$$.fragment.d(1);
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
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
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
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
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
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (!stop) {
                    return; // not ready
                }
                subscribers.forEach((s) => s[1]());
                subscribers.forEach((s) => s[0](value));
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                }
            };
        }
        return { set, update, subscribe };
    }
    /**
     * Get the current value from a store by subscribing and immediately unsubscribing.
     * @param store readable
     */
    function get(store) {
        let value;
        store.subscribe((_) => value = _)();
        return value;
    }

    const user = writable({
      name: "Anon",
    });

    const messages = writable([
      // {
      //  id: 0,
    	// 	message: "",
    	// 	username: "",
    	// 	attachments: [
    	// 		{
    	// 			id: "STRHASH",
    	// 			type: "file",
    	// 			name: "file.txt",
    	// 			size: 10000, // bytes
    	// 		},
    	// 	],
    	// }
    ]);

    const room = writable("main");

    // Connection socket
    let socketBox = {
      socket: null,
      socketId: null,
    };

    const socket = writable(socketBox);

    let socketUpdate = socket.update.bind(socket);
    socket.update = function(updateCb) {
      socketBox = updateCb(socketBox);
      socketUpdate(() => socketBox);
    };

    socket.get = function() {
      return socketBox
    };

    function postCommand(name, data, resCb) {
      const { socket: sock, socketId } = socket.get();

      if (sock) {
        sock.emit("COMMAND", name, data, (data) => {
          if (data.error) {
            console.error(`Error running command "${ name }": ` + data.error);
          } else {
            resCb(data.data);
          }
        });
      }
    }

    function postMessage(message) {
      let messageIndex;
      const userData = get(user);

      // Post new message and set its message ID when the server responds
      postCommand("post", {
        room: "main",
        message,
      }, ({ id }) => {
        messages.update(messages => {
          messages[messageIndex].id = id;
          return messages
        });
      });

    	messages.update(messages => {
        messageIndex = messages.length;
        const newMessage = {
          id: -1,
      		message: message.message,
    			clientId: socket.get().socketId,
      		username: userData.name,
          attachments: [],
      	};

        return messages.concat(newMessage)
      });
    }

    function deleteMessage(room, id) {
      messages.update(messages => {
        const msgIndex = messages.findIndex(m => m.id === id);
        let message;

        if (msgIndex !== -1 && (message = messages[msgIndex]).clientId === socket.get().socketId) {
          messages.splice(msgIndex, 1);

          console.log("MESSAGE DEL", id, room);
          postCommand("deletemessage", {
            id,
            room,
          }, () => {
            // ... success ?
          });
        }

        return messages
      });
    }

    function loadMessages(room = "main") {
      postCommand("getmessages", {
        room,
      }, serverMessages => {
        console.log("MESSAGES", serverMessages);
        messages.update(() => {
          return serverMessages.messages
        });

        syncMessages();
      });
    }

    function syncMessages() {
      const { socket: sock, socketId } = socket.get();

      sock.on("newmessages", serverMessages => {
        messages.update(messages => {
          return messages.concat(serverMessages.messages.filter(m => m.clientId !== socketId))
        });
      });

      sock.on("messagedelete", ({ room: roomId, id }) => {
        const curRoom = get(room);

        if (roomId === curRoom) {
          messages.update(messages => messages.filter(m => m.id !== id));
        }
      });
    }

    /* src/app/views/Logo.html generated by Svelte v3.5.4 */

    const file = "src/app/views/Logo.html";

    function create_fragment(ctx) {
    	var svg, path;

    	return {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr(path, "d", "M11.92 1.32v11.72h2.34V7.66c0-.2.05-.38.13-.53.09-.15.2-.29.33-.4.15-.1.32-.17.5-.21.17-.06.36-.08.55-.08.43 0 .73.13.9.4.17.25.25.64.25 1.18v5.02h2.35V7.83a3.9 3.9 0 0 0-.67-2.44c-.43-.57-1.07-.85-1.93-.85-.65 0-1.17.16-1.53.47-.37.32-.63.7-.78 1.13h-.1V1.32zm29.44 0v4.8h-.08a1.94 1.94 0 0 0-.81-1.14c-.41-.3-.89-.44-1.43-.44-1.05 0-1.85.37-2.39 1.1-.53.74-.8 1.82-.8 3.24 0 1.41.27 2.5.8 3.24.54.74 1.34 1.1 2.4 1.1.26 0 .51-.03.75-.12a2.16 2.16 0 0 0 1.18-.82c.13-.2.23-.41.3-.63h.08v1.39h2.34V1.32zM6.22 1.8c-.75 0-1.43.12-2.03.38-.6.25-1.11.63-1.54 1.12a5.1 5.1 0 0 0-.98 1.82 8.02 8.02 0 0 0-.35 2.47c0 .94.12 1.77.35 2.47.23.7.56 1.28.98 1.76.43.46.94.82 1.54 1.06.6.23 1.28.35 2.03.35a4.4 4.4 0 0 0 2.53-.68 4.95 4.95 0 0 0 1.63-1.97L8.42 9.45c-.17.45-.44.84-.8 1.17-.34.31-.81.47-1.4.47-.71 0-1.28-.23-1.71-.68-.43-.46-.64-1.13-.64-2.01V6.63c0-.88.21-1.54.64-2 .43-.46 1-.7 1.7-.7.6 0 1.06.15 1.37.43.31.28.55.65.7 1.11l2.07-1.08c-.4-.9-.94-1.55-1.6-1.96a4.65 4.65 0 0 0-2.53-.63zm24.72.68v1.36c0 .29-.06.5-.17.67-.12.14-.34.22-.65.22h-.59v1.82h1.17v4.07c0 .79.2 1.39.62 1.8.42.41 1.04.62 1.85.62h1.4v-1.82h-1.52V6.55h1.64V4.73h-1.64V2.48zm-6.47 2.06c-.87 0-1.57.14-2.09.42-.5.28-.93.66-1.26 1.16l1.39 1.24c.18-.26.4-.48.68-.69.27-.2.64-.3 1.1-.3.5 0 .86.12 1.07.37.21.23.32.55.32.95v.52h-1.32c-1.1 0-1.97.22-2.61.65-.63.42-.95 1.07-.95 1.95 0 .72.22 1.31.66 1.75.45.45 1.09.67 1.92.67.63 0 1.17-.14 1.6-.41.43-.29.71-.7.84-1.24h.1c.07.45.24.8.52 1.06.28.27.63.4 1.06.4h1.3v-1.82h-.78V7.58c0-1-.3-1.75-.89-2.27-.59-.51-1.48-.77-2.66-.77zm15.35 1.9c.44 0 .8.1 1.1.33.29.21.44.5.44.89v2.45c0 .38-.15.68-.45.9-.28.21-.65.32-1.09.32-.44 0-.81-.15-1.1-.46a1.82 1.82 0 0 1-.44-1.27V8.16c0-.52.15-.94.43-1.25.3-.31.67-.47 1.11-.47zm-15.28 3.1h1.14v.98c0 .38-.15.66-.43.83-.28.16-.6.25-1 .25-.35 0-.62-.07-.8-.2-.2-.16-.3-.38-.3-.69v-.24c0-.62.47-.93 1.39-.93zm22.7.82c-.48 0-.83.12-1.06.37-.23.23-.34.53-.34.9v.32c0 .37.11.67.34.91.23.24.58.35 1.06.35.47 0 .82-.11 1.04-.35.23-.24.35-.54.35-.91v-.32c0-.37-.12-.67-.35-.9-.22-.25-.57-.37-1.04-.37z");
    			attr(path, "class", "svelte-lt2tiq");
    			add_location(path, file, 10, 2, 221);
    			attr(svg, "class", "logo svelte-lt2tiq");
    			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr(svg, "width", ctx.width);
    			attr(svg, "viewBox", "0 0 49.95 14.55");
    			add_location(svg, file, 9, 0, 125);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, svg, anchor);
    			append(svg, path);
    		},

    		p: function update(changed, ctx) {
    			if (changed.width) {
    				attr(svg, "width", ctx.width);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(svg);
    			}
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { width = 120 } = $$props;

    	const writable_props = ['width'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Logo> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('width' in $$props) $$invalidate('width', width = $$props.width);
    	};

    	return { width };
    }

    class Logo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["width"]);
    	}

    	get width() {
    		throw new Error("<Logo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Logo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/app/views/MessageList.html generated by Svelte v3.5.4 */

    const file$1 = "src/app/views/MessageList.html";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.msg = list[i];
    	return child_ctx;
    }

    // (79:4) {#if msg.id !== -1 && $socket.socketId === msg.clientId}
    function create_if_block(ctx) {
    	var button, dispose;

    	function click_handler() {
    		return ctx.click_handler(ctx);
    	}

    	return {
    		c: function create() {
    			button = element("button");
    			button.textContent = "×";
    			attr(button, "class", "delete svelte-160rqxm");
    			add_location(button, file$1, 79, 5, 2096);
    			dispose = listen(button, "click", click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, button, anchor);
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(button);
    			}

    			dispose();
    		}
    	};
    }

    // (73:1) {#each $messages as msg}
    function create_each_block(ctx) {
    	var div2, div0, span0, t0_value = ctx.msg.username, t0, t1, t2, span1, t3_value = ctx.msg.message, t3, t4, div1, t5;

    	var if_block = (ctx.msg.id !== -1 && ctx.$socket.socketId === ctx.msg.clientId) && create_if_block(ctx);

    	return {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = text(":");
    			t2 = space();
    			span1 = element("span");
    			t3 = text(t3_value);
    			t4 = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t5 = space();
    			attr(span0, "class", "name svelte-160rqxm");
    			add_location(span0, file$1, 75, 4, 1905);
    			attr(span1, "class", "message-body svelte-160rqxm");
    			add_location(span1, file$1, 75, 46, 1947);
    			attr(div0, "class", "text svelte-160rqxm");
    			add_location(div0, file$1, 74, 3, 1882);
    			attr(div1, "class", "actions svelte-160rqxm");
    			add_location(div1, file$1, 77, 3, 2008);
    			attr(div2, "class", "message svelte-160rqxm");
    			add_location(div2, file$1, 73, 2, 1857);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, span0);
    			append(span0, t0);
    			append(span0, t1);
    			append(div0, t2);
    			append(div0, span1);
    			append(span1, t3);
    			append(div2, t4);
    			append(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append(div2, t5);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.$messages) && t0_value !== (t0_value = ctx.msg.username)) {
    				set_data(t0, t0_value);
    			}

    			if ((changed.$messages) && t3_value !== (t3_value = ctx.msg.message)) {
    				set_data(t3, t3_value);
    			}

    			if (ctx.msg.id !== -1 && ctx.$socket.socketId === ctx.msg.clientId) {
    				if (!if_block) {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div2);
    			}

    			if (if_block) if_block.d();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var div;

    	var each_value = ctx.$messages;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c: function create() {
    			div = element("div");

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    			attr(div, "class", "messages svelte-160rqxm");
    			add_location(div, file$1, 69, 0, 1779);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			add_binding_callback(() => ctx.div_binding(div, null));
    		},

    		p: function update(changed, ctx) {
    			if (changed.$messages || changed.$socket) {
    				each_value = ctx.$messages;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if (changed.items) {
    				ctx.div_binding(null, div);
    				ctx.div_binding(div, null);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			destroy_each(each_blocks, detaching);

    			ctx.div_binding(null, div);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $messages, $socket, $room;

    	validate_store(messages, 'messages');
    	subscribe($$self, messages, $$value => { $messages = $$value; $$invalidate('$messages', $messages); });
    	validate_store(socket, 'socket');
    	subscribe($$self, socket, $$value => { $socket = $$value; $$invalidate('$socket', $socket); });
    	validate_store(room, 'room');
    	subscribe($$self, room, $$value => { $room = $$value; $$invalidate('$room', $room); });

    	

      let messageCount = get(messages).length;
      let newMessageCount = messageCount;
    	let messagesWrap;
    	let autoscroll = true;

    	function checkShouldScroll() {
    		if (messagesWrap) {
    			const { scrollHeight, scrollTop, offsetHeight } = messagesWrap;

    			// Check if already scrolled to the bottom (and keep doing it)
    			autoscroll = (scrollHeight - offsetHeight) - scrollTop === 0;
    		}
    	}

      messages.subscribe((messages) => {
        newMessageCount = messages.length;
        checkShouldScroll();
      });

    	afterUpdate(() => {
    		// Keep scrolled to the bottom
    		if (messagesWrap && autoscroll && newMessageCount !== messageCount) {
    			const { scrollHeight } = messagesWrap;
    			messagesWrap.scrollTop = scrollHeight; $$invalidate('messagesWrap', messagesWrap);
    		}

        messageCount = newMessageCount;
    	});

    	function click_handler({ msg }) {
    		return deleteMessage($room, msg.id);
    	}

    	function div_binding($$node, check) {
    		messagesWrap = $$node;
    		$$invalidate('messagesWrap', messagesWrap);
    	}

    	return {
    		messagesWrap,
    		$messages,
    		$socket,
    		$room,
    		click_handler,
    		div_binding
    	};
    }

    class MessageList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
    	}
    }

    /* src/app/views/App.html generated by Svelte v3.5.4 */

    const file$2 = "src/app/views/App.html";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.attachment = list[i];
    	child_ctx.index = i;
    	return child_ctx;
    }

    // (192:2) {#each curAttachments as attachment, index}
    function create_each_block$1(ctx) {
    	var div1, div0, t0_value = ctx.attachment.name, t0, t1, button, t3, dispose;

    	function click_handler() {
    		return ctx.click_handler(ctx);
    	}

    	return {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			button = element("button");
    			button.textContent = "×";
    			t3 = space();
    			attr(div0, "class", "name svelte-xx5z8q");
    			add_location(div0, file$2, 193, 4, 4410);
    			attr(button, "class", "remove svelte-xx5z8q");
    			add_location(button, file$2, 194, 4, 4456);
    			attr(div1, "class", "attachment svelte-xx5z8q");
    			add_location(div1, file$2, 192, 3, 4381);
    			dispose = listen(button, "click", click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, t0);
    			append(div1, t1);
    			append(div1, button);
    			append(div1, t3);
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if ((changed.curAttachments) && t0_value !== (t0_value = ctx.attachment.name)) {
    				set_data(t0, t0_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
    			}

    			dispose();
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	var div0, t0, div4, t1, div2, div1, t2_value = ctx.curAttachments.length, t2, t3, t4, t5, div3, button0, t7, input0, t8, button1, t10, div5, form, input1, current, dispose;

    	var logo = new Logo({
    		props: { width: 150 },
    		$$inline: true
    	});

    	var messageslist = new MessageList({ $$inline: true });

    	var each_value = ctx.curAttachments;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c: function create() {
    			div0 = element("div");
    			logo.$$.fragment.c();
    			t0 = space();
    			div4 = element("div");
    			messageslist.$$.fragment.c();
    			t1 = space();
    			div2 = element("div");
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = text(" attachments");
    			t4 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t5 = space();
    			div3 = element("div");
    			button0 = element("button");
    			button0.textContent = "+";
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			button1 = element("button");
    			button1.textContent = "Post";
    			t10 = space();
    			div5 = element("div");
    			form = element("form");
    			input1 = element("input");
    			attr(div0, "class", "logo svelte-xx5z8q");
    			add_location(div0, file$2, 180, 0, 4083);
    			attr(div1, "class", "attachment-count svelte-xx5z8q");
    			add_location(div1, file$2, 190, 2, 4260);
    			attr(div2, "class", "attachment-shelf svelte-xx5z8q");
    			toggle_class(div2, "is-visible", ctx.curAttachments.length);
    			add_location(div2, file$2, 187, 1, 4180);
    			attr(button0, "class", "add-attachment svelte-xx5z8q");
    			add_location(button0, file$2, 202, 2, 4592);
    			attr(input0, "type", "text");
    			attr(input0, "class", "message-input svelte-xx5z8q");
    			attr(input0, "placeholder", "Message... Or /nick New Nick");
    			add_location(input0, file$2, 205, 2, 4668);
    			attr(button1, "class", "submit svelte-xx5z8q");
    			add_location(button1, file$2, 211, 2, 4852);
    			attr(div3, "class", "post svelte-xx5z8q");
    			add_location(div3, file$2, 201, 1, 4571);
    			attr(div4, "class", "messages-view svelte-xx5z8q");
    			add_location(div4, file$2, 184, 0, 4132);
    			attr(input1, "type", "file");
    			input1.multiple = true;
    			add_location(input1, file$2, 220, 2, 4993);
    			add_location(form, file$2, 218, 1, 4956);
    			attr(div5, "class", "hidden svelte-xx5z8q");
    			add_location(div5, file$2, 217, 0, 4934);

    			dispose = [
    				listen(button0, "click", ctx.addAttachments),
    				listen(input0, "input", ctx.input0_input_handler),
    				listen(input0, "keyup", ctx.keyup_handler),
    				listen(button1, "click", ctx.postMessage),
    				listen(input1, "change", ctx.listNewAttachment)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div0, anchor);
    			mount_component(logo, div0, null);
    			insert(target, t0, anchor);
    			insert(target, div4, anchor);
    			mount_component(messageslist, div4, null);
    			append(div4, t1);
    			append(div4, div2);
    			append(div2, div1);
    			append(div1, t2);
    			append(div1, t3);
    			append(div2, t4);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append(div4, t5);
    			append(div4, div3);
    			append(div3, button0);
    			append(div3, t7);
    			append(div3, input0);

    			input0.value = ctx.curMessage;

    			append(div3, t8);
    			append(div3, button1);
    			insert(target, t10, anchor);
    			insert(target, div5, anchor);
    			append(div5, form);
    			append(form, input1);
    			add_binding_callback(() => ctx.input1_binding(input1, null));
    			add_binding_callback(() => ctx.form_binding(form, null));
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if ((!current || changed.curAttachments) && t2_value !== (t2_value = ctx.curAttachments.length)) {
    				set_data(t2, t2_value);
    			}

    			if (changed.curAttachments) {
    				each_value = ctx.curAttachments;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if (changed.curAttachments) {
    				toggle_class(div2, "is-visible", ctx.curAttachments.length);
    			}

    			if (changed.curMessage && (input0.value !== ctx.curMessage)) input0.value = ctx.curMessage;
    			if (changed.items) {
    				ctx.input1_binding(null, input1);
    				ctx.input1_binding(input1, null);
    			}
    			if (changed.items) {
    				ctx.form_binding(null, form);
    				ctx.form_binding(form, null);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(logo.$$.fragment, local);

    			transition_in(messageslist.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(logo.$$.fragment, local);
    			transition_out(messageslist.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div0);
    			}

    			destroy_component(logo, );

    			if (detaching) {
    				detach(t0);
    				detach(div4);
    			}

    			destroy_component(messageslist, );

    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach(t10);
    				detach(div5);
    			}

    			ctx.input1_binding(null, input1);
    			ctx.form_binding(null, form);
    			run_all(dispose);
    		}
    	};
    }

    const nickCommand = "/nick ";

    function instance$2($$self, $$props, $$invalidate) {
    	

    	let curMessage = "";
    	// let curAttachments = [{
    	// 	id: "",
    	// 	type: "file",
    	// 	name: "virus.exe",
    	// 	size: 113131,
    	// }, {
    	// 	id: "",
    	// 	type: "file",
    	// 	name: "cool-things.png",
    	// 	size: 41141,
    	// }]
    	let curAttachments = [];
    	let currentFileFormData = new FormData();
    	let fileInput;
    	let fileInputForm;

    	function postMessage$1() {
    		if (curMessage.trim()) {
    			const username = get(user).name;

    			if (curMessage.slice(0, nickCommand.length) === nickCommand) {
    				// Just change the nick
    				user.update(u => ({
    					...u,
    					name: curMessage.slice(nickCommand.length),
    				}));
    			} else {
    				// Post a message
    				postMessage({
    					id: -1,
    					username,
    					message: curMessage,
    					attachments: [],
    				});
    			}

    			$$invalidate('curMessage', curMessage = "");
    		}
    	}

    	function addAttachments() {
    		fileInput && fileInput.click();
    	}

    	function listNewAttachment() {
    		const files = Array.from(fileInput.files);

    		for (const file of files) {
    			curAttachments.push({
    				id: "",
    				type: "file",
    				// @ts-ignore
    				name: file.name,
    				// @ts-ignore
    				size: file.size,
    			});

    			// @ts-ignore
    			currentFileFormData.append("attachments[]", file);
    		}

    		$$invalidate('curAttachments', curAttachments);
    		fileInputForm.reset();
    	}

    	function removeAttachment(index) {
    		curAttachments.splice(index, 1);
    		$$invalidate('curAttachments', curAttachments);
    	}

    	function click_handler({ index }) {
    		return removeAttachment(index);
    	}

    	function input0_input_handler() {
    		curMessage = this.value;
    		$$invalidate('curMessage', curMessage);
    	}

    	function keyup_handler() {
    		return (event.keyCode === 13 && postMessage$1());
    	}

    	function input1_binding($$node, check) {
    		fileInput = $$node;
    		$$invalidate('fileInput', fileInput);
    	}

    	function form_binding($$node, check) {
    		fileInputForm = $$node;
    		$$invalidate('fileInputForm', fileInputForm);
    	}

    	return {
    		curMessage,
    		curAttachments,
    		fileInput,
    		fileInputForm,
    		postMessage: postMessage$1,
    		addAttachments,
    		listNewAttachment,
    		removeAttachment,
    		click_handler,
    		input0_input_handler,
    		keyup_handler,
    		input1_binding,
    		form_binding
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.getElementById("app"),
    	props: {},
    });

    const sock = io.connect("http://" + location.host + "/chat");
    socket.update(s => ({
    	socket: sock,
    }));

    // Load current messages after connection is established
    sock.on("connect", () => {
    	loadMessages();
    });

    sock.on("client", ({ id }) => {
    	socket.update(s => ({
    		...s,
    		socketId: id,
    	}));
    });

    return app;

}(io));
//# sourceMappingURL=bundle.js.map
