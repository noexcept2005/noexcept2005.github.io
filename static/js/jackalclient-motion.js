(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = value => Math.min(1, Math.max(0, value));
    const easeOutCubic = progress => 1 - (1 - progress) ** 3;
    const easeInExpo = progress => progress <= 0 ? 0 : 2 ** (10 * progress - 10);
    const easeOutBack = progress => 1 + 2.70158 * (progress - 1) ** 3 + 1.70158 * (progress - 1) ** 2;
    const easeInOutSine = progress => -(Math.cos(Math.PI * progress) - 1) / 2;
    const scenes = [...document.querySelectorAll('.jc-scene')];
    const desktop = document.querySelector('[data-story="desktop"]');
    const dropdown = desktop?.querySelector('.jc-dropdown-showcase');
    const dropdownColumns = [...document.querySelectorAll('.jc-dropdown-column')];
    const desktopBackdrop = desktop?.querySelector('.jc-desktop-backdrop');
    const moduleLines = desktop && window.createJackalModuleLines ? window.createJackalModuleLines(desktop) : null;
    const customSection = document.querySelector('[data-story="custom"]');
    const sequence = customSection && window.createJackalSequence ? window.createJackalSequence(customSection) : null;
    const videoSection = document.querySelector('[data-story="video"]');
    const videos = videoSection && window.createJackalVideos ? window.createJackalVideos(videoSection) : null;
    const glassCanvas = document.getElementById('desktopGlass');
    const glass = glassCanvas && window.createJackalGlass ? window.createJackalGlass(glassCanvas) : null;
    const motionToggle = document.getElementById('glassMotionToggle');
    const letterRecords = new Map();
    let userPaused = false;
    let frame = 0;
    let resizePending = true;
    let previousColor = '';

    document.querySelectorAll('.jc-page-heading h1').forEach(title => {
        title.dataset.jcTitle = '';
        const track = document.createElement('div');
        track.className = 'jc-title-track';
        title.before(track);
        track.append(title);
    });
    const titles = [...document.querySelectorAll('[data-jc-title]')];
    const words = [...document.querySelectorAll('.jc-backdrop-word')];
    const waves = scenes.map(element => {
        const color = getComputedStyle(element).getPropertyValue('--jc-scene-bg').trim();
        let canvas = null;
        let context = null;
        if (previousColor && previousColor !== color) {
            canvas = document.createElement('canvas');
            canvas.className = 'jc-wipe';
            canvas.setAttribute('aria-hidden', 'true');
            try { context = canvas.getContext('2d'); } catch {}
            if (context) element.prepend(canvas);
        }
        const wave = { element, canvas, context, color: previousColor, width: 0, height: 0 };
        previousColor = element.dataset.story === 'desktop' ? '#121414' : color;
        return wave;
    });

    function passage(center, height) {
        const enter = easeOutCubic(clamp((height - center) / (height * .5)));
        const exit = easeInExpo(clamp((height * .26 - center) / (height * .46)));
        return { enter, exit, opacity: enter * (1 - exit) };
    }

    function playLetters(element) {
        const record = letterRecords.get(element);
        if (!record || record.played || preference.matches || element.hasAttribute('data-jc-wave')) return;
        record.played = true;
        record.glyphs.forEach((glyph, index) => {
            const seed = (glyph.textContent.codePointAt(0) * 29 + index * 71) % 421;
            const animation = glyph.animate([{ opacity: 0, transform: 'translateY(.45em)' }, { opacity: 1, transform: 'translateY(0)' }], {
                duration: 620, delay: seed, easing: 'cubic-bezier(.215,.61,.355,1)', fill: 'backwards'
            });
            animation.onfinish = () => animation.cancel();
            record.animations.push(animation);
        });
    }

    const letterObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            if (entry.target.closest('.jc-modules-panel') && !desktop?.classList.contains('is-modules')) return;
            if (entry.target.closest('.jc-desktop-cheat')?.inert) return;
            playLetters(entry.target);
        });
    }, { threshold: .1 }) : null;

    function prepareLetters() {
        letterObserver?.disconnect();
        letterRecords.forEach(record => record.animations.forEach(animation => animation.cancel()));
        letterRecords.clear();
        document.querySelectorAll('[data-jc-letters]').forEach(element => {
            const text = element.querySelector('.jc-sr-only')?.textContent || element.textContent;
            element.textContent = text;
            if (preference.matches || !Element.prototype.animate) return;
            const readable = document.createElement('span');
            readable.className = 'jc-sr-only';
            readable.textContent = text;
            const visual = document.createElement('span');
            visual.setAttribute('aria-hidden', 'true');
            const tokens = typeof Intl.Segmenter === 'function'
                ? [...new Intl.Segmenter(document.documentElement.lang, { granularity: 'word' }).segment(text)].map(token => token.segment)
                : text.match(/\s+|[A-Za-z0-9]+|[^\s]/gu) || [];
            const glyphs = [];
            tokens.forEach(token => {
                if (/^\s+$/.test(token)) { visual.append(document.createTextNode(token)); return; }
                const word = document.createElement('span');
                word.className = 'jc-letter-word';
                const characters = typeof Intl.Segmenter === 'function'
                    ? [...new Intl.Segmenter(document.documentElement.lang, { granularity: 'grapheme' }).segment(token)].map(character => character.segment)
                    : [...token];
                characters.forEach(character => {
                    const glyph = document.createElement('span');
                    glyph.className = 'jc-glyph';
                    glyph.textContent = character;
                    word.append(glyph);
                    glyphs.push(glyph);
                });
                visual.append(word);
            });
            element.replaceChildren(readable, visual);
            letterRecords.set(element, { glyphs, played: false, animations: [] });
            if (letterObserver) letterObserver.observe(element);
            else playLetters(element);
        });
    }

    function updateMotionButton() {
        if (!motionToggle) return;
        motionToggle.hidden = preference.matches || glassCanvas?.dataset.renderer !== 'webgl2';
        motionToggle.setAttribute('aria-pressed', String(userPaused));
        motionToggle.dataset.i18n = userPaused ? 'motion.resume' : 'motion.pause';
        motionToggle.textContent = jackalText(motionToggle.dataset.i18n);
    }

    function drawWave(wave, progress) {
        const { context, width, height } = wave;
        if (!context || !width || !height) return;
        context.clearRect(0, 0, width, height);
        if (progress >= 1) return;
        const release = easeInOutSine(clamp((progress - .08) / .92));
        context.globalAlpha = 1 - release;
        const spacing = innerWidth <= 600 ? 18 : 24;
        const columns = Math.ceil(width / spacing);
        const rows = Math.ceil(height / spacing);
        context.fillStyle = wave.color;
        context.beginPath();
        for (let row = 0; row <= rows; row++) {
            for (let column = 0; column <= columns; column++) {
                const diagonal = row / rows * .85 + column / columns * .15;
                const local = clamp((diagonal + progress * .65 - .38) / .9);
                const dissolve = local * local * (3 - 2 * local);
                const radius = spacing * .84 * (1 - dissolve) * (1 - release * .8);
                if (radius < .2) continue;
                const horizontal = column * spacing;
                const vertical = row * spacing;
                context.moveTo(horizontal + radius, vertical);
                context.arc(horizontal, vertical, radius, 0, Math.PI * 2);
            }
        }
        context.fill();
    }

    function render() {
        frame = 0;
        if (document.hidden) return;
        const reduced = preference.matches;
        document.body.classList.toggle('jc-motion', !reduced);
        const height = innerHeight;
        const sceneMeasurements = waves.map(wave => ({ wave, bounds: wave.element.getBoundingClientRect() }));
        const titleMeasurements = titles.map(title => ({ title, bounds: title.parentElement.getBoundingClientRect() }));
        const wordMeasurements = words.map(word => ({ word, bounds: word.closest('.jc-scene').getBoundingClientRect() }));
        const range = document.documentElement.scrollHeight - height;
        document.body.style.setProperty('--jc-page-progress', range > 0 ? clamp(scrollY / range) : 1);
        glass?.setPaused(reduced || userPaused);
        document.body.classList.toggle('jc-showcase-paused', reduced || userPaused);

        sceneMeasurements.forEach(({ wave, bounds }) => {
            if (wave.canvas) wave.canvas.hidden = reduced;
            if (reduced) return;
            if (resizePending && wave.context) {
                const density = Math.min(devicePixelRatio || 1, 1.5);
                wave.width = bounds.width;
                wave.height = wave.element.dataset.wipe === 'compact' ? Math.min(100, bounds.height * .28) : Math.min(620, Math.max(280, height * .56));
                wave.canvas.style.height = `${wave.height}px`;
                wave.canvas.width = Math.round(wave.width * density);
                wave.canvas.height = Math.round(wave.height * density);
                wave.context.setTransform(density, 0, 0, density, 0, 0);
            }
            if (bounds.top > height || bounds.bottom < 0) return;
            const position = Math.min(1, Math.max(-1, bounds.top / height));
            wave.element.style.setProperty('--jc-drift', `${Math.round(position * 48)}px`);
            wave.element.style.setProperty('--jc-rotation', `${-24 + position * 12}deg`);
            drawWave(wave, clamp((height * 1.15 - bounds.top) / height));
        });

        if (!reduced) {
            titleMeasurements.forEach(({ title, bounds }) => {
                if (title.id === 'desktopTitle') return;
                const progress = passage(bounds.top + bounds.height / 2, height);
                title.style.setProperty('--jc-title-opacity', progress.opacity.toFixed(5));
                title.style.setProperty('--jc-title-x', `${((1 - progress.enter) * 180 - progress.exit * 130).toFixed(2)}px`);
                title.style.setProperty('--jc-title-y', `${((1 - progress.enter) * 38).toFixed(2)}px`);
                title.dataset.enter = progress.enter.toFixed(5);
                title.dataset.exit = progress.exit.toFixed(5);
            });
            wordMeasurements.forEach(({ word, bounds }) => {
                if (word === desktopBackdrop) return;
                const enter = easeOutCubic(clamp((height * .5 - bounds.top) / (height * .5)));
                const spaceAfter = document.documentElement.scrollHeight - scrollY - bounds.bottom;
                const exitEnd = Math.max(height * .5, height - spaceAfter);
                const exit = easeInExpo(clamp((height * 1.35 - bounds.bottom) / Math.max(1, height * 1.35 - exitEnd)));
                word.style.setProperty('--jc-word-opacity', (enter * (1 - exit)).toFixed(5));
                word.style.setProperty('--jc-word-x', `${((1 - enter) * innerWidth * .45 - exit * (innerWidth + word.offsetWidth)).toFixed(2)}px`);
                word.dataset.enter = enter.toFixed(5);
                word.dataset.exit = exit.toFixed(5);
            });
        }

        const desktopMeasurement = sceneMeasurements.find(measurement => measurement.wave.element === desktop);
        if (desktopMeasurement) {
            const { bounds } = desktopMeasurement;
            if (resizePending) desktop.style.setProperty('--jc-gui-tallest', `${Math.max(...dropdownColumns.map(column => column.offsetHeight))}px`);
            const progress = clamp(-bounds.top / Math.max(1, bounds.height - height));
            const guiEntrance = clamp((progress - .015) / .418);
            const sceneEntry = easeOutCubic(clamp((height - bounds.top) / (height * .8)));
            const heroExit = clamp((guiEntrance - .5) / .22);
            const sceneExit = easeOutCubic(clamp((progress - .6) / .14));
            const showModules = !reduced && progress >= .66;
            desktop.dataset.progress = progress.toFixed(5);
            desktop.dataset.guiEntrance = guiEntrance.toFixed(5);
            desktop.classList.toggle('is-modules', showModules);
            desktop.classList.toggle('is-dropdown', !reduced && progress > .015 && progress < .81);
            desktop.style.setProperty('--jc-glass-opacity', sceneEntry * (1 - sceneExit));
            desktop.style.setProperty('--jc-glass-scale', .86 + sceneEntry * .14);
            desktop.style.setProperty('--jc-desktop-copy-opacity', sceneEntry * (1 - easeOutCubic(heroExit)));
            desktop.style.setProperty('--jc-desktop-copy-scale', (.86 + sceneEntry * .14) * (1 - easeOutBack(heroExit) * .38));
            const desktopTitle = document.getElementById('desktopTitle');
            desktopTitle.style.setProperty('--jc-title-opacity', 1);
            desktopTitle.dataset.enter = sceneEntry.toFixed(5);
            desktopTitle.dataset.exit = heroExit.toFixed(5);
            const taglineEntry = clamp((guiEntrance - .5) / .48);
            const taglineExit = easeOutCubic(clamp((progress - .58) / .14));
            desktop.style.setProperty('--jc-tagline-opacity', 1 - taglineExit);
            const tagline = desktop.querySelector('[data-jc-wave]');
            const record = letterRecords.get(tagline);
            record?.glyphs.forEach((glyph, index) => {
                const local = clamp((taglineEntry - index / record.glyphs.length * .42) / .58);
                const eased = easeOutCubic(local);
                const wave = Math.sin(local * Math.PI * 2 - index * .24) * (1 - local) * 9;
                glyph.style.opacity = eased;
                glyph.style.transform = `translateY(${(1 - eased) * 55 + wave}px) rotate(${(1 - eased) * -5}deg)`;
            });
            tagline.setAttribute('aria-hidden', String(!reduced && (taglineEntry <= 0 || taglineExit >= 1)));
            const backdropText = guiEntrance >= .4 ? 'CLICKGUI' : 'INTRODUCING';
            if (desktopBackdrop.textContent !== backdropText) desktopBackdrop.textContent = backdropText;
            const backdropEntry = easeOutCubic(clamp((height * .5 - bounds.top) / (height * .5)));
            const backdropExit = easeInExpo(clamp((progress - .6) / .21));
            desktopBackdrop.style.setProperty('--jc-word-opacity', backdropEntry * (1 - backdropExit));
            desktopBackdrop.style.setProperty('--jc-word-x', `${(1 - backdropEntry) * innerWidth * .45 - backdropExit * (innerWidth + desktopBackdrop.offsetWidth)}px`);
            desktopBackdrop.dataset.enter = backdropEntry.toFixed(5);
            desktopBackdrop.dataset.exit = backdropExit.toFixed(5);
            const guiExit = easeInExpo(clamp((progress - .6) / .21));
            desktop.style.setProperty('--jc-gui-opacity', easeOutCubic(clamp(progress / .04)) * (1 - guiExit));
            desktop.style.setProperty('--jc-gui-scale', 1 + guiExit * 1.8);
            desktop.style.setProperty('--jc-gui-blur', `${guiExit * 28}px`);
            const gutter = dropdown ? parseFloat(getComputedStyle(dropdown).left) || 0 : 0;
            const availableWidth = bounds.width - gutter * 2;
            const horizontalTravel = Math.max(0, (dropdown?.offsetWidth || 0) - availableWidth);
            desktop.style.setProperty('--jc-gui-pan', `${-horizontalTravel * clamp((progress - .16) / .5)}px`);
            dropdownColumns.forEach((column, index) => {
                const entry = clamp((progress - .015 - index * .028) / .25);
                const eased = .5 - Math.cos(Math.PI * entry) * .5;
                column.style.setProperty('--jc-column-y', `${(eased - 1) * height * 1.15}px`);
            });
            const moduleExit = clamp((progress - .88) / .12) ** 3;
            desktop.style.setProperty('--jc-modules-darkness', easeOutCubic(clamp((progress - .62) / .08)));
            const imageExit = easeInOutSine(clamp((progress - .84) / .16));
            const bubble = 1 - easeOutCubic(clamp((progress - .68) / .18));
            desktop.style.setProperty('--jc-modules-opacity', 1 - moduleExit);
            desktop.style.setProperty('--jc-modules-y', '0px');
            desktop.style.setProperty('--jc-modules-parallax', `${-moduleExit * height * .23}px`);
            desktop.style.setProperty('--jc-modules-image-y', `${-moduleExit * height * .07}px`);
            desktop.style.setProperty('--jc-modules-image-fade', 1 - imageExit);
            desktop.style.setProperty('--jc-bokeh-opacity', showModules ? bubble : 0);
            desktop.style.setProperty('--jc-bokeh-scale', .1 + bubble * 1.6);
            moduleLines?.update(progress, reduced, resizePending);
            const cheat = desktop.querySelector('.jc-desktop-cheat');
            const modules = desktop.querySelector('.jc-modules-panel');
            const hideCheat = !reduced && progress >= .74;
            cheat.inert = hideCheat;
            modules.inert = !reduced && !showModules;
            cheat.setAttribute('aria-hidden', String(hideCheat));
            modules.setAttribute('aria-hidden', String(!reduced && !showModules));
            if (!hideCheat) cheat.querySelectorAll('[data-jc-letters]').forEach(playLetters);
            glass?.setVisible(!reduced && bounds.top < height && bounds.bottom > 0 && progress < .74);

        }
        const videoMeasurement = sceneMeasurements.find(measurement => measurement.wave.element === videoSection);
        if (videoMeasurement) videos?.update(videoMeasurement.bounds, height, reduced);
        const custom = sceneMeasurements.find(measurement => measurement.wave.element === customSection);
        if (custom) sequence?.update(custom.bounds, height, reduced);
        if (resizePending) glass?.resize();
        resizePending = false;
    }

    function requestRender() { if (!frame && !document.hidden) frame = requestAnimationFrame(render); }
    function requestResize() { resizePending = true; requestRender(); }
    motionToggle?.addEventListener('click', () => { userPaused = !userPaused; updateMotionButton(); requestRender(); });
    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestResize, { passive: true });
    window.addEventListener('pageshow', requestResize);
    window.addEventListener('pagehide', event => { cancelAnimationFrame(frame); frame = 0; glass?.setVisible(false); if (!event.persisted) { glass?.destroy(); videos?.destroy(); } });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; glass?.setVisible(false); document.body.classList.add('jc-showcase-paused'); }
        else requestResize();
    });
    document.addEventListener('jackal:language', () => { prepareLetters(); updateMotionButton(); requestResize(); });
    document.addEventListener('jackal:glass', updateMotionButton);
    preference.addEventListener('change', () => { prepareLetters(); updateMotionButton(); requestResize(); });
    if ('ResizeObserver' in window) new ResizeObserver(requestResize).observe(document.getElementById('main'));
    document.fonts?.ready.then(requestResize);
    prepareLetters();
    updateMotionButton();
    requestRender();
})();
