'use client';

import {useEffect} from 'react';
import {animate, inView} from 'motion';

/** Progressive enhancement: the server-rendered artwork is always visible. */
export function HomeMotion() {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    const active: Array<{cancel: () => void}> = [];
    const stopWatching = [
      inView('.comic', element => {
        const offer = element.querySelector('.comic-offer');
        const feedback = element.querySelector('.comic-feedback');
        if (offer) active.push(animate(offer, {transform: ['translateX(-10px)', 'translateX(5px)', 'translateX(0px)']}, {duration: .9, ease: 'easeOut'}));
        if (feedback) active.push(animate(feedback, {transform: ['translateX(0px)', 'translateX(-8px)', 'translateX(0px)']}, {delay: .9, duration: .8, ease: 'easeInOut'}));
      }, {amount: .35}),
      inView('.invitation', element => {
        const path = element.querySelector('.invitation-path');
        if (path) active.push(animate(path, {strokeDashoffset: [32, 0], opacity: [.45, 1]}, {duration: .75, ease: 'easeOut'}));
      }, {amount: .35}),
    ];
    const stop = () => { stopWatching.forEach(cancel => cancel()); active.forEach(animation => animation.cancel()); };
    const onPreferenceChange = (event: MediaQueryListEvent) => { if (event.matches) stop(); };
    preference.addEventListener('change', onPreferenceChange);
    return () => { preference.removeEventListener('change', onPreferenceChange); stop(); };
  }, []);
  return null;
}
