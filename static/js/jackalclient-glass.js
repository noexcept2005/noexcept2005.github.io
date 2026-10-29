(() => {
    window.createJackalGlass = canvas => {
        let context;
        try { context = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' }); } catch {}
        let program = null;
        let buffer = null;
        let vertexArray = null;
        let timeUniform;
        let resolutionUniform;
        let frame = 0;
        let elapsed = 0;
        let lastTick = 0;
        let lastPaint = 0;
        let visible = false;
        let paused = true;
        let destroyed = false;
        let paintCount = 0;
        canvas.dataset.renderer = 'static';

        const vertexSource = `#version 300 es
            layout(location = 0) in vec2 position;
            void main() { gl_Position = vec4(position, 0.0, 1.0); }
        `;
        const fragmentSource = `#version 300 es
            precision highp float;
            uniform float elapsedTime;
            uniform vec2 resolution;
            out vec4 outputColor;
            float hashValue(vec2 point) {
                point = fract(point * vec2(123.34, 456.21));
                point += dot(point, point + 45.32);
                return fract(point.x * point.y);
            }
            float noiseValue(vec2 point) {
                vec2 cell = floor(point);
                vec2 blend = fract(point);
                blend = blend * blend * (3.0 - 2.0 * blend);
                return mix(mix(hashValue(cell), hashValue(cell + vec2(1, 0)), blend.x), mix(hashValue(cell + vec2(0, 1)), hashValue(cell + vec2(1, 1)), blend.x), blend.y);
            }
            void main() {
                vec2 coordinate = gl_FragCoord.xy / resolution;
                vec2 point = coordinate * vec2(resolution.x / resolution.y, 1.0);
                float clock = elapsedTime * 0.12;
                vec2 warp = vec2(noiseValue(point * 2.4 + clock), noiseValue(point * 2.1 - clock + 7.0));
                float river = sin(point.x * 3.4 + point.y * 2.2 + warp.x * 4.0 - clock * 2.0);
                float current = noiseValue(point * 3.2 + warp * 2.0 + clock * 0.4);
                vec3 paleBlue = vec3(0.74, 0.91, 1.0);
                vec3 skyBlue = vec3(0.22, 0.67, 0.94);
                vec3 color = mix(skyBlue, paleBlue, smoothstep(-1.1, 1.1, river + current * 0.5));
                float sheen = pow(max(0.0, 1.0 - abs(river + current * 0.32)), 14.0);
                color += vec3(0.13, 0.17, 0.19) * sheen;
                color = mix(color, vec3(0.91, 0.97, 1.0), 0.12 * coordinate.y);
                outputColor = vec4(color, 1.0);
            }
        `;

        function stop() {
            cancelAnimationFrame(frame);
            frame = 0;
            lastTick = 0;
        }

        function fallback() {
            stop();
            canvas.hidden = true;
            canvas.dataset.renderer = 'static';
            document.dispatchEvent(new CustomEvent('jackal:glass'));
        }

        function compile(source, type) {
            const shader = context.createShader(type);
            if (!shader) return null;
            context.shaderSource(shader, source);
            context.compileShader(shader);
            if (context.getShaderParameter(shader, context.COMPILE_STATUS)) return shader;
            context.deleteShader(shader);
            return null;
        }

        function release() {
            if (!context) return;
            if (program) context.deleteProgram(program);
            if (buffer) context.deleteBuffer(buffer);
            if (vertexArray) context.deleteVertexArray(vertexArray);
            program = buffer = vertexArray = null;
        }

        function draw() {
            if (!program || destroyed || context.isContextLost()) return;
            context.useProgram(program);
            context.bindVertexArray(vertexArray);
            context.uniform1f(timeUniform, elapsed);
            context.uniform2f(resolutionUniform, canvas.width, canvas.height);
            context.drawArrays(context.TRIANGLES, 0, 3);
            canvas.dataset.frames = String(++paintCount);
        }

        function resize() {
            if (!program || destroyed) return;
            const bounds = canvas.parentElement.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const density = Math.min(window.devicePixelRatio || 1, 1.25, 1200 / bounds.width, 800 / bounds.height);
            const width = Math.max(1, Math.round(bounds.width * density));
            const height = Math.max(1, Math.round(bounds.height * density));
            if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
            context.viewport(0, 0, canvas.width, canvas.height);
            draw();
        }

        function tick(timestamp) {
            frame = 0;
            if (destroyed || !visible || paused || document.hidden || !program) return;
            if (timestamp - lastPaint >= 32) {
                if (lastTick) elapsed += Math.min(.05, (timestamp - lastTick) / 1000);
                lastTick = timestamp;
                lastPaint = timestamp;
                draw();
            }
            frame = requestAnimationFrame(tick);
        }

        function synchronize() {
            if (destroyed || !visible || paused || document.hidden || !program) stop();
            else if (!frame) frame = requestAnimationFrame(tick);
        }

        function initialize() {
            if (!context || destroyed) { fallback(); return; }
            release();
            const vertex = compile(vertexSource, context.VERTEX_SHADER);
            const fragment = compile(fragmentSource, context.FRAGMENT_SHADER);
            if (!vertex || !fragment) {
                if (vertex) context.deleteShader(vertex);
                if (fragment) context.deleteShader(fragment);
                fallback();
                return;
            }
            program = context.createProgram();
            if (!program) { context.deleteShader(vertex); context.deleteShader(fragment); fallback(); return; }
            context.attachShader(program, vertex);
            context.attachShader(program, fragment);
            context.linkProgram(program);
            context.deleteShader(vertex);
            context.deleteShader(fragment);
            if (!context.getProgramParameter(program, context.LINK_STATUS)) { release(); fallback(); return; }
            vertexArray = context.createVertexArray();
            buffer = context.createBuffer();
            if (!vertexArray || !buffer) { release(); fallback(); return; }
            context.bindVertexArray(vertexArray);
            context.bindBuffer(context.ARRAY_BUFFER, buffer);
            context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW);
            context.enableVertexAttribArray(0);
            context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
            timeUniform = context.getUniformLocation(program, 'elapsedTime');
            resolutionUniform = context.getUniformLocation(program, 'resolution');
            canvas.hidden = false;
            canvas.dataset.renderer = 'webgl2';
            document.dispatchEvent(new CustomEvent('jackal:glass'));
            resize();
            synchronize();
        }

        function contextLost(event) { event.preventDefault(); fallback(); }
        canvas.addEventListener('webglcontextlost', contextLost);
        canvas.addEventListener('webglcontextrestored', initialize);
        initialize();
        return {
            setVisible(value) { visible = value; synchronize(); },
            setPaused(value) { paused = value; synchronize(); },
            resize,
            destroy() {
                destroyed = true;
                stop();
                release();
                canvas.removeEventListener('webglcontextlost', contextLost);
                canvas.removeEventListener('webglcontextrestored', initialize);
            }
        };
    };
})();
