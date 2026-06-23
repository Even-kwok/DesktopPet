export class StudioWindowController {
  #isVisible = false;

  get isVisible() {
    return this.#isVisible;
  }

  show() {
    this.#isVisible = true;
  }

  hide() {
    this.#isVisible = false;
  }
}
