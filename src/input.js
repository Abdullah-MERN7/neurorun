// Input Manager handling Keyboard and Touch Gestures with Question Mode support

export class InputManager {
  constructor() {
    this.handlers = {
      onLeft: null,
      onRight: null,
      onJump: null,
      onSlide: null,
      onPause: null,
      onDigit: null,
      onConfirm: null
    };

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.minSwipeDistance = 35;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);

    this.attach();
  }

  attach() {
    window.addEventListener('keydown', this.boundKeyDown, { passive: false });
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: false });
  }

  detach() {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchend', this.boundTouchEnd);
  }

  handleKeyDown(e) {
    const code = e.code;

    // Prevent default browser scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }

    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (this.handlers.onLeft) this.handlers.onLeft();
        break;

      case 'ArrowRight':
      case 'KeyD':
        if (this.handlers.onRight) this.handlers.onRight();
        break;

      case 'ArrowUp':
      case 'KeyW':
        if (this.handlers.onJump) this.handlers.onJump();
        break;

      case 'Space':
        // Space acts as confirm in question mode or jump in runner
        if (this.handlers.onConfirm) {
          const handled = this.handlers.onConfirm();
          if (!handled && this.handlers.onJump) this.handlers.onJump();
        } else if (this.handlers.onJump) {
          this.handlers.onJump();
        }
        break;

      case 'Enter':
        if (this.handlers.onConfirm) this.handlers.onConfirm();
        break;

      case 'ArrowDown':
      case 'KeyS':
        if (this.handlers.onSlide) this.handlers.onSlide();
        break;

      case 'Digit1':
      case 'Numpad1':
        if (this.handlers.onDigit) this.handlers.onDigit(0);
        break;

      case 'Digit2':
      case 'Numpad2':
        if (this.handlers.onDigit) this.handlers.onDigit(1);
        break;

      case 'Digit3':
      case 'Numpad3':
        if (this.handlers.onDigit) this.handlers.onDigit(2);
        break;

      case 'Digit4':
      case 'Numpad4':
        if (this.handlers.onDigit) this.handlers.onDigit(3);
        break;

      case 'Escape':
      case 'KeyP':
        if (this.handlers.onPause) this.handlers.onPause();
        break;
    }
  }

  handleTouchStart(e) {
    if (e.touches && e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  }

  handleTouchEnd(e) {
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const deltaX = e.changedTouches[0].clientX - this.touchStartX;
    const deltaY = e.changedTouches[0].clientY - this.touchStartY;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) > this.minSwipeDistance) {
      if (absX > absY) {
        if (deltaX > 0 && this.handlers.onRight) {
          this.handlers.onRight();
        } else if (deltaX < 0 && this.handlers.onLeft) {
          this.handlers.onLeft();
        }
      } else {
        if (deltaY < 0 && this.handlers.onJump) {
          this.handlers.onJump();
        } else if (deltaY > 0 && this.handlers.onSlide) {
          this.handlers.onSlide();
        }
      }
    }
  }
}
