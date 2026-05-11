class QueueManager {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
  }

  setQueue(tracks) {
    this.queue = Array.isArray(tracks) ? tracks : [];
    this.currentIndex = this.queue.length > 0 ? 0 : -1;
  }

  addToQueue(track) {
    this.queue.push(track);
    if (this.currentIndex < 0) {
      this.currentIndex = 0;
    }
  }

  clear() {
    this.queue = [];
    this.currentIndex = -1;
  }

  getCurrentTrack() {
    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) {
      return null;
    }
    return this.queue[this.currentIndex];
  }

  next() {
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex += 1;
      return this.getCurrentTrack();
    }
    return null;
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex -= 1;
      return this.getCurrentTrack();
    }
    return null;
  }

  onTrackEnd() {
    return this.next();
  }
}

module.exports = new QueueManager();
