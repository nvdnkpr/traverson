'use strict';

var halfred = require('halfred')
var minilog = require('minilog')
var _s = require('underscore.string')
var Walker = require('./walker')

var log = minilog('traverson')

function JsonHalWalker() {}

JsonHalWalker.prototype = new Walker()

JsonHalWalker.prototype.findNextStep = function(doc, key) {
  log.debug('parsing hal')
  var halResource = halfred.parse(doc)

  var index = parseIndex(key)
  key = parseKey(key)

  // try _links first
  var step = findLink(halResource, key, index)
  if (step) {
    return step
  }

  // no link found, check for _embedded
  step = findEmbedded(halResource, doc, key, index)
  if (step) {
    return step
  }
  throw new Error('Could not find a link nor an embedded object for ' + key +
      ' in document:\n' + JSON.stringify(doc))
}

function findLink(halResource, key, index) {
  var linkArray = halResource.linkArray(key)

  if (!linkArray || linkArray.length === 0) {
    return null
  }

  var step = findLinkByIndex(linkArray, key, index)
  if (!step) {
    step = findLinkWithoutIndex(linkArray, key)
  }
  return step
}

function findLinkByIndex(linkArray, key, index) {
  if (index) {
    // client specified an explicit array index for this link, so use it or fail
    if (!linkArray[index]) {
      throw new Error(key + '[' + index + '] requested, but link array ' +
          key + ' had no element at index ' + index)
    }
    if (!linkArray[index].href) {
      throw new Error(key + '[' + index + '] requested, but this link had ' +
          ' no href attribute.')
    }
    log.debug('found hal link: ' + linkArray[index].href)
    return { uri: linkArray[index].href }
  }
  return null
}

function findLinkWithoutIndex(linkArray, key) {
  // client did not specify an array index for this link, arbitrarily choose
  // the first that has a href attribute
  var link
  for (var index = 0; index < linkArray.length; index++) {
    if (linkArray[index].href) {
      link = linkArray[index]
      break
    }
  }
  if (link) {
    if (linkArray.length > 1) {
      log.warn('Found HAL link array with more than one element for ' +
          'key ' + key + ', arbitrarily choosing index ' + index +
          ', because it was the first that had a href attribute.')
    }
    log.debug('found hal link: ' + link.href)
    return { uri: link.href }
  }
  return null
}


function findEmbedded(halResource, doc, key, index) {
  log.debug('checking for embedded: ' + key + (index?index:''))

  var resourceArray = halResource.embeddedArray(key)
  if (!resourceArray || resourceArray.length === 0) {
    return null
  }
  log.debug('Found an array of embedded resource for: ' + key)

  var step = findeEmbeddedByIndex(resourceArray, key, index)
  if (!step) {
    step = findEmbeddedWithoutIndex(resourceArray, key)
  }
  return step
}

function findeEmbeddedByIndex(resourceArray, key, index) {
  if (index) {
    // client specified an explicit array index, so use it or fail
    if (!resourceArray[index]) {
      throw new Error(key + '[' + index + '] requested, but there is no such ' +
          'link. However, there is an embedded resource array named ' + key +
          ' but it does not have an element at index ' + index)
    }
    log.debug('Found an embedded resource for: ' + key + '[' + index + ']')
    return { doc: resourceArray[index].original() }
  }
  return null
}

function findEmbeddedWithoutIndex(resourceArray, key) {
  // client did not specify an array index, arbitrarily choose first
  if (resourceArray.length > 1) {
    log.warn('Found HAL embedded resource array with more than one element ' +
        ' for key ' + key + ', arbitrarily choosing first element.')
  }
  return { doc: resourceArray[0].original() }
}

function parseIndex(key) {
  var match = key.match(/.*\[(\d+)\]/)
  if (match) {
    return match[1]
  }
  return null
}

function parseKey(key) {
  var match = key.match(/(.*)\[\d+\]/)
  if (match) {
    return match[1]
  }
  return key
}

JsonHalWalker.prototype.postProcessStep = function(nextStep) {
  if (nextStep.uri) {
    if (_s.endsWith(this.startUri, '/') &&
        _s.startsWith(nextStep.uri, '/')) {
      nextStep.uri = _s.splice(nextStep.uri, 0, 1)
    }
    nextStep.uri = this.startUri + nextStep.uri
  }
}

module.exports = JsonHalWalker
