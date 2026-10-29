(() => {
    const clamp = value => Math.max(0, Math.min(1, value));
    const easeInOutSine = progress => -(Math.cos(Math.PI * progress) - 1) / 2;

    window.createJackalSequence = section => {
        const media = section.querySelector('.jc-custom-media');
        const sequence = section.querySelector('.jc-custom-sequence');
        const frames = [...sequence.querySelectorAll('.jc-custom-frame')];
        const link = media.querySelector('a');
        let preloaded = false;
        section.classList.add('jc-sequence-enhanced');

        return {
            update(bounds, viewportHeight, reduced) {
                if (!preloaded && bounds.top < viewportHeight * 2.2) {
                    preloaded = true;
                    sequence.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
                }
                const progress = clamp(-bounds.top / Math.max(1, bounds.height - viewportHeight));
                const entry = clamp((viewportHeight * .88 - bounds.top) / (viewportHeight * .72));
                const spring = entry >= 1 ? 1 : 1 - Math.exp(-7 * entry) * (Math.cos(11 * entry) + 7 / 11 * Math.sin(11 * entry));
                const traversal = clamp((progress - .03) / .65) * 4;
                const active = Math.min(3, Math.floor(traversal));
                const local = easeInOutSine(traversal - active);
                const boundary = 1.06 - local * 1.12;
                const shutters = !reduced && progress >= .73;
                const exit = reduced ? 0 : easeInOutSine(clamp((progress - .84) / .16));
                section.dataset.sequenceProgress = progress.toFixed(5);
                section.dataset.sequenceFrame = String(reduced ? 1 : Math.min(5, Math.floor(traversal) + 1));
                section.classList.toggle('is-custom-shutters', shutters);
                media.style.setProperty('--jc-custom-scale', reduced ? 1 : .82 + spring * .18);
                media.style.setProperty('--jc-custom-opacity', reduced ? 1 : clamp(entry * 3));
                sequence.style.setProperty('--jc-sequence-exit', `${(1 - exit) * 100}%`);
                const flashPhase = clamp((progress - .70) / .06);
                sequence.style.setProperty('--jc-sequence-flash', reduced ? 0 : Math.sin(flashPhase * Math.PI) ** 2 * .94);
                frames.forEach((image, index) => {
                    let clipping = 'inset(0)';
                    if (reduced) clipping = index === 0 ? 'inset(0)' : 'inset(0 0 0 100%)';
                    else if (index > active + 1) clipping = 'inset(0 0 0 100%)';
                    else if (index === active + 1) clipping = `polygon(${(boundary - .025) * 100}% 0, 100% 0, 100% 100%, ${(boundary + .025) * 100}% 100%)`;
                    image.style.clipPath = clipping;
                });
                const scanPosition = shutters ? 1 - exit : boundary;
                sequence.style.setProperty('--jc-scan-position', `${scanPosition * 100}%`);
                sequence.style.setProperty('--jc-scan-visible', reduced || (shutters ? exit <= 0 || exit >= 1 : traversal <= 0 || traversal >= 4) ? 0 : 1);
                const selected = frames[Math.min(4, Math.floor(traversal))];
                link.href = (reduced ? frames[0] : selected).src.replace(/\.webp$/, '.png');
                link.inert = !reduced && exit >= .99;
            }
        };
    };

    window.createJackalModuleLines = container => {
        const records = [];
        let layoutKey = '';

        function prepare() {
            const elements = [...container.querySelectorAll('[data-jc-lines]')];
            const key = elements.map(element => `${element.clientWidth}:${element.querySelector('.jc-sr-only')?.textContent || element.textContent}`).join('|') + document.documentElement.lang;
            if (key === layoutKey) return;
            layoutKey = key;
            records.length = 0;
            elements.forEach(element => {
                const text = element.querySelector('.jc-sr-only')?.textContent || element.textContent;
                const readable = document.createElement('span');
                readable.className = 'jc-sr-only';
                readable.textContent = text;
                const visual = document.createElement('span');
                visual.setAttribute('aria-hidden', 'true');
                const tokens = typeof Intl.Segmenter === 'function'
                    ? [...new Intl.Segmenter(document.documentElement.lang, { granularity: 'word' }).segment(text)].map(token => token.segment)
                    : text.match(/\s+|[A-Za-z0-9]+|[^\s]/gu) || [];
                const words = tokens.map(token => {
                    const word = document.createElement('span');
                    word.textContent = token;
                    word.style.whiteSpace = 'pre';
                    word.style.display = 'inline-block';
                    visual.append(word);
                    return word;
                });
                element.replaceChildren(readable, visual);
                const rows = new Map();
                words.forEach(word => {
                    const top = word.offsetTop;
                    if (!rows.has(top)) rows.set(top, []);
                    rows.get(top).push(word);
                });
                const lines = [...rows.values()].map(row => {
                    const line = document.createElement('span');
                    line.className = 'jc-text-line';
                    line.textContent = row.map(word => word.textContent).join('').trim();
                    return line;
                });
                visual.replaceChildren(...lines);
                records.push({ element, lines });
            });
        }

        return {
            update(progress, reduced, refresh) {
                if (refresh || !records.length) prepare();
                let order = 0;
                records.forEach(({ element, lines }, group) => {
                    lines.forEach(line => {
                        const entry = reduced ? 1 : clamp((progress - .68 - order * .018) / .1);
                        const eased = 1 - (1 - entry) ** 3;
                        line.style.opacity = eased;
                        line.style.transform = `translateY(${(1 - eased) * -32}px)`;
                        order++;
                    });
                    const bubble = reduced || group > 0 ? 0 : 1 - clamp((progress - .68) / .19);
                    element.style.filter = `blur(${bubble * 16}px)`;
                    element.style.transform = `scale(${1 + bubble * .16})`;
                });
            }
        };
    };
})();
