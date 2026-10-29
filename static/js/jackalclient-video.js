(() => {
    window.createJackalVideos = section => {
        const options = [...section.querySelectorAll('.jc-video-option')];
        const slots = [...section.querySelectorAll('.jc-video-option-slot')];
        const list = section.querySelector('.jc-video-options');
        const hint = section.querySelector('.jc-video-hint');
        const player = section.querySelector('iframe');
        const fallback = section.querySelector('.jc-video-fallback a');
        const more = section.querySelector('.jc-video-more');
        const mobile = matchMedia('(max-width: 767px)');
        const coarse = matchMedia('(hover: none)');
        const springAnimations = [];
        let activated = false;
        let shown = false;
        let eligible = false;
        let inView = false;
        let reduced = false;
        let dwellTimer = 0;
        let hintTimer = 0;
        let hintReady = false;
        let moreExpanded = false;
        let exiting = false;
        let pointerFrame = 0;
        let pointer = null;
        section.classList.add('jc-video-enhanced');

        function cancelDwell() {
            clearTimeout(dwellTimer);
            clearTimeout(hintTimer);
            dwellTimer = 0;
            hintTimer = 0;
        }

        function synchronizeHint() {
            const visible = hintReady && eligible && !activated && !document.hidden;
            section.classList.toggle('is-video-hint-visible', visible);
            hint.setAttribute('aria-hidden', String(!visible));
        }

        function synchronizeLink() {
            const handheld = mobile.matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            more.href = 'https://space.bilibili.com/3494361276877525' + (handheld ? '' : '/lists/3986082?type=season');
        }

        function stopSprings() {
            springAnimations.splice(0).forEach(animation => animation.cancel());
        }

        function reveal() {
            if (shown) return;
            shown = true;
            section.classList.add('is-video-list-visible');
            list.inert = false;
            slots.forEach(slot => { slot.inert = false; });
            list.setAttribute('aria-hidden', 'false');
            requestPointer();
            if (reduced || !Element.prototype.animate) return;
            options.forEach((option, index) => {
                const keyframes = Array.from({ length: 61 }, (_, sample) => {
                    const time = sample / 60;
                    const displacement = Math.exp(-7 * time) * (Math.cos(14 * time) + .5 * Math.sin(14 * time));
                    return { transform: `translateX(${sample === 60 ? 0 : displacement * 150}px)`, opacity: Math.min(1, time * 5), offset: time };
                });
                const animation = option.animate(keyframes, { duration: 1000, delay: index * 110, fill: 'backwards', easing: 'linear' });
                animation.onfinish = () => animation.cancel();
                springAnimations.push(animation);
            });
        }

        function conceal() {
            if (!shown) return;
            shown = false;
            stopSprings();
            section.classList.remove('is-video-list-visible');
            list.inert = true;
            list.setAttribute('aria-hidden', 'true');
            moreExpanded = false;
            section.classList.remove('is-video-more-visible', 'is-video-rail-near');
        }

        function synchronizeDwell() {
            if (activated || !eligible || document.hidden) {
                cancelDwell();
                hintReady = false;
                synchronizeHint();
                return;
            }
            if (!hintReady && !hintTimer) hintTimer = setTimeout(() => {
                hintTimer = 0;
                hintReady = eligible && !document.hidden;
                synchronizeHint();
            }, 2000);
            if (dwellTimer) return;
            dwellTimer = setTimeout(() => {
                dwellTimer = 0;
                if (!eligible || document.hidden) return;
                activated = true;
                section.dataset.videoActivated = 'true';
                cancelDwell();
                synchronizeHint();
                if (inView) reveal();
            }, 10000);
        }

        function updatePointer() {
            pointerFrame = 0;
            const railBounds = list.getBoundingClientRect();
            const distanceFrom = bounds => {
                if (!pointer) return Infinity;
                const horizontal = Math.max(bounds.left - pointer.x, 0, pointer.x - bounds.right);
                const vertical = Math.max(bounds.top - pointer.y, 0, pointer.y - bounds.bottom);
                return Math.hypot(horizontal, vertical);
            };
            const railFocus = list.contains(document.activeElement);
            const nearRail = distanceFrom(railBounds) < 150 || railFocus;
            const nearLast = distanceFrom(options.at(-1).getBoundingClientRect()) < 85;
            if (nearLast || document.activeElement === options.at(-1) || document.activeElement === more || coarse.matches) moreExpanded = true;
            else if (!nearRail) moreExpanded = false;
            section.classList.toggle('is-video-rail-near', nearRail);
            section.classList.toggle('is-video-more-visible', moreExpanded);
            more.inert = !moreExpanded || exiting;
            more.setAttribute('aria-hidden', String(!moreExpanded || exiting));
            options.forEach(option => {
                const bounds = option.getBoundingClientRect();
                const horizontal = pointer ? Math.max(bounds.left - pointer.x, 0, pointer.x - bounds.right) : 180;
                const vertical = pointer ? Math.max(bounds.top - pointer.y, 0, pointer.y - bounds.bottom) : 180;
                const proximity = pointer ? Math.max(0, 1 - Math.hypot(horizontal, vertical) / 180) : 0;
                const focused = option === document.activeElement;
                option.style.setProperty('--jc-cover-blur', `${focused ? 0 : 6 * (1 - proximity)}px`);
                option.style.setProperty('--jc-cover-scale', String(1 + proximity * .035));
            });
        }

        function requestPointer() {
            if (!pointerFrame && shown && !document.hidden) pointerFrame = requestAnimationFrame(updatePointer);
        }

        function pointerMove(event) {
            if (event.pointerType === 'touch') return;
            pointer = { x: event.clientX, y: event.clientY };
            requestPointer();
        }

        function pointerLeave() { pointer = null; requestPointer(); }

        options.forEach(option => {
            option.addEventListener('click', event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                const source = new URL('https://player.bilibili.com/player.html');
                source.search = new URLSearchParams({ aid: option.dataset.aid, cid: option.dataset.cid, page: '1', autoplay: '1', danmaku: '0', high_quality: '1' }).toString();
                player.src = source.href;
                fallback.href = option.href;
                options.forEach(candidate => {
                    if (candidate === option) candidate.setAttribute('aria-current', 'true');
                    else candidate.removeAttribute('aria-current');
                });
                section.dataset.selectedAid = option.dataset.aid;
            });
            option.addEventListener('focus', requestPointer);
            option.addEventListener('blur', requestPointer);
            option.addEventListener('keydown', event => {
                const index = options.indexOf(option);
                const destination = event.key === 'ArrowDown' ? (index + 1) % options.length
                    : event.key === 'ArrowUp' ? (index + options.length - 1) % options.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1;
                if (destination < 0) return;
                event.preventDefault();
                options[destination].focus({ preventScroll: true });
            });
        });

        function visibilityChange() {
            if (document.hidden) { cancelDwell(); hintReady = false; synchronizeHint(); cancelAnimationFrame(pointerFrame); pointerFrame = 0; }
            else synchronizeDwell();
        }

        function update(measurement, viewportHeight, reduceMotion) {
            if (reduced !== reduceMotion) stopSprings();
            reduced = reduceMotion;
            const visibleHeight = Math.max(0, Math.min(measurement.bottom, viewportHeight) - Math.max(measurement.top, 0));
            inView = visibleHeight > 0;
            eligible = visibleHeight >= viewportHeight * .6;
            synchronizeDwell();
            if (activated && inView) reveal();
            else conceal();
            const clamp = value => Math.max(0, Math.min(1, value));
            const entry = clamp((viewportHeight - measurement.top) / viewportHeight);
            const exit = clamp((viewportHeight - measurement.bottom) / (viewportHeight * .8));
            exiting = exit >= .99;
            section.style.setProperty('--jc-film-blur', `${reduced ? 0 : entry * 16}px`);
            section.style.setProperty('--jc-film-opacity', String(.65 * (1 - (reduced ? 0 : exit))));
            const helperExit = reduced ? 0 : clamp((viewportHeight * 1.12 - measurement.bottom) / (viewportHeight * .45));
            section.style.setProperty('--jc-video-helper-opacity', String(1 - helperExit));
            section.querySelector('.jc-video-fallback').inert = helperExit >= .99;
            more.style.setProperty('--jc-more-exit-opacity', String(1 - exit));
            more.style.pointerEvents = exit >= .99 ? 'none' : '';
            slots.forEach((slot, index) => {
                const progress = reduced ? 0 : clamp((viewportHeight * .86 - measurement.bottom + index * 45) / (viewportHeight * .65));
                const eased = progress <= 0 ? 0 : 2 ** (10 * progress - 10);
                slot.style.setProperty('--jc-cover-exit-x', `${eased * 220}px`);
                slot.style.setProperty('--jc-cover-opacity', String(1 - eased));
                slot.inert = !shown || progress >= .99;
            });
            if (shown) requestPointer();
        }

        window.addEventListener('pointermove', pointerMove, { passive: true });
        window.addEventListener('pointerover', pointerMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', pointerLeave);
        document.addEventListener('visibilitychange', visibilityChange);
        list.addEventListener('focusin', requestPointer);
        list.addEventListener('focusout', requestPointer);
        mobile.addEventListener('change', synchronizeLink);
        coarse.addEventListener('change', requestPointer);
        synchronizeLink();
        more.inert = true;
        more.setAttribute('aria-hidden', 'true');
        list.inert = true;
        list.setAttribute('aria-hidden', 'true');
        return {
            update,
            destroy() {
                cancelDwell();
                stopSprings();
                cancelAnimationFrame(pointerFrame);
                window.removeEventListener('pointermove', pointerMove);
                window.removeEventListener('pointerover', pointerMove);
                document.documentElement.removeEventListener('pointerleave', pointerLeave);
                document.removeEventListener('visibilitychange', visibilityChange);
                list.removeEventListener('focusin', requestPointer);
                list.removeEventListener('focusout', requestPointer);
                mobile.removeEventListener('change', synchronizeLink);
                coarse.removeEventListener('change', requestPointer);
            }
        };
    };
})();
