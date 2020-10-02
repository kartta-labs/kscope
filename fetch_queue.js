// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

class FetchQueue {

  constructor(maxPending) {
    this.maxPending = maxPending;
    this.pending = {};
    this.waiting = [];
    this.seq = 0;
    this.nPending = 0;
    this.nWaiting = 0;
  }

  fetch(url) {
    const promise = this.addToWaiting(url);
    this.processOneWaitingIfPossible();
    return promise;
  }

  addToWaiting(url) {
    this.nWaiting += 1;
    const requestDetails = {
      url: url
    };
    const promise = new Promise((resolve,reject) => {
      requestDetails.resolve = resolve;
      requestDetails.reject = reject;
    });
    this.waiting.push(requestDetails);
    return promise;
  }

  processOneWaitingIfPossible() {
    if (this.nWaiting <= 0 || this.nPending >= this.maxPending) {
      return;
    }
    const requestDetails = this.waiting.shift();
    this.nWaiting -= 1;
    this.nPending += 1;
    this.pending[requestDetails.url] = requestDetails;
    fetch(requestDetails.url)
    .then(response => {
      requestDetails.resolve(response);
    })
    .catch(error => {
      requestDetails.reject(error);
    })
    .finally(() => {
      this.nPending -= 1;
      delete this.pending[requestDetails.url];
      this.processOneWaitingIfPossible();
    });
  }

}

export {FetchQueue};
