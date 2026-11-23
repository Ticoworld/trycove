'use client';

import {useEffect} from 'react';
import {animate, inView} from 'motion';

/** The server-rendered artwork remains complete when motion is unavailable. */
export function HomeMotion() {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const active: Array<{cancel: () => void}> = [];
    const observers: Array<() => void> = [];
    let comicSeen = false;
    let invitationSeen = false;
    const stop = () => {
      observers.splice(0).forEach(cancel => cancel());
      active.splice(0).forEach(animation => animation.cancel());
    };
    const setup = () => {
      if (preference.matches) return;
      if (!comicSeen) observers.push(inView('.comic', element => {
        comicSeen = true;
        const maker = element.querySelector('.comic-maker-tool');
        const offer = element.querySelector('.comic-offer');
        const slot = element.querySelector('.comic-slot');
        const feedback = element.querySelector('.comic-feedback');
        const returnPath = element.querySelector('.comic-return');
        if (maker) active.push(animate(maker, {opacity: [1, .55, 1], transform: ['translateX(0px)', 'translateX(15px)', 'translateX(0px)']}, {duration: .65, ease: 'easeInOut'}));
        if (offer) active.push(animate(offer, {transform: ['translateX(0px)', 'translateX(-45px)', 'translateX(18px)', 'translateX(0px)'], opacity: [1, .65, 1, 1]}, {delay: .45, duration: .9, ease: 'easeOut'}));
        if (slot) active.push(animate(slot, {opacity: [1, .4, 1]}, {delay: 1.15, duration: .6, ease: 'easeInOut'}));
        if (feedback) active.push(animate(feedback, {opacity: [1, .5, 1], transform: ['translateX(0px)', 'translateX(18px)', 'translateX(0px)']}, {delay: 1.55, duration: .65, ease: 'easeOut'}));
        if (returnPath) active.push(animate(returnPath, {opacity: [1, .4, 1], transform: ['translateX(0px)', 'translateX(12px)', 'translateX(0px)']}, {delay: 1.95, duration: .5, ease: 'easeOut'}));
      }, {amount: .3}));
      if (!invitationSeen) observers.push(inView('.invitation', element => {
        invitationSeen = true;
        const path = element.querySelector('.invitation-path');
        const piece = element.querySelector('.invitation-piece');
        if (path) active.push(animate(path, {opacity: [.4, 1]}, {duration: .7, ease: 'easeOut'}));
        if (piece) active.push(animate(piece, {transform: ['translateX(0px)', 'translateX(-28px)', 'translateX(0px)'], opacity: [1, .6, 1]}, {delay: .3, duration: .8, ease: 'easeOut'}));
      }, {amount: .3}));
    };
    const onPreferenceChange = () => { stop(); setup(); };
    setup();
    preference.addEventListener('change', onPreferenceChange);
    return () => { preference.removeEventListener('change', onPreferenceChange); stop(); };
  }, []);
  return null;
}
