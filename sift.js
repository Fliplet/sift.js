/*
 * Sift 3.x	
 *	
 * Copryright 2015, Craig Condon	
 * Licensed under MIT	
 *	
 * Filter JavaScript objects with mongodb queries	
 *
 * The fork of this library is maintained by Fliplet
 * https://github.com/Fliplet/sift.js
 */
(function() {

  'use strict';

  /**
   */

  function isFunction(value) {
    return typeof value === 'function';
  }

  /**
   */

  function isArray(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  }

  /**
   */

  function comparable(value) {
    if (value instanceof Date) {
      return value.getTime();
    } else if (isArray(value)) {
      return value.map(comparable);
    } else if (value && typeof value.toJSON === 'function') {
      return value.toJSON();
    } else {
      return value;
    }
  }

  /**
   * Added by Fliplet
   * https://stackoverflow.com/questions/1068834/object-comparison-in-javascript
   */
  function compareObjects(x, y) {
    if (x === y) return true;
    // if both x and y are null or undefined and exactly the same

    if (!(x instanceof Object) || !(y instanceof Object)) return false;
    // if they are not strictly equal, they both need to be Objects

    if (x.constructor !== y.constructor) return false;
    // they must have the exact same prototype chain, the closest we can do is
    // test there constructor.

    for (var p in x) {
      if (!x.hasOwnProperty(p)) continue;
      // other properties were tested using x.constructor === y.constructor

      if (!y.hasOwnProperty(p)) return false;
      // allows to compare x[ p ] and y[ p ] when set to undefined

      if (x[p] === y[p]) continue;
      // if they have the same strict value or identity then they are equal

      if (typeof x[p] !== "object") return false;
      // Numbers, Strings, Functions, Booleans must be strictly equal

      if (!Object.equals(x[p], y[p])) return false;
      // Objects and Arrays must be tested recursively
    }

    for (p in y) {
      if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) return false;
      // allows x[ p ] to be set to undefined
    }
    return true;
  }


  /**
   * Given a value, most of the times would be a string try to return
   * a value to compare. It will work for things like:
   * "-$1", "01-01-2018", "1 dollar"
   * Return NaN if we can't get something
   * @param {*} value - Value to compare
   */
  function flComparable(value) {
    var result;
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      // Try to parse is as a Date
      var validDateFormat = /([0-9]{2,4})([-.])([0-9]{2})\2([0-9]{2,4})/;
      if (value.match(validDateFormat)) {
        var date = new Date(value);
        return result = date.getTime();
      }

      // Try to parse float
      result = parseFloat(value.replace(/[^0-9,\.-]+/, ''));
    }

    return result;
  }

  function isComparable(a, b) {
    return !(isNaN(a) && isNaN(b));
  }

  function get(obj, key) {
    return isFunction(obj.get) ? obj.get(key) : obj[key];
  }

  /**
   */

  function or(validator) {
    return function(a, b) {
      if (!isArray(b) || !b.length) {
        return validator(a, b);
      }
      for (var i = 0, n = b.length; i < n; i++) {
        if (validator(a, get(b,i))) return true;
      }
      return false;
    }
  }

  /**
   */

  function and(validator) {
    return function(a, b) {
      if (!isArray(b) || !b.length) {
        return validator(a, b);
      }
      for (var i = 0, n = b.length; i < n; i++) {
        if (!validator(a, get(b, i))) return false;
      }
      return true;
    };
  }

  function validate(validator, b, k, o) {
    return validator.v(validator.a, b, k, o);
  }

  var OPERATORS = {

    /**
     */

    $eq: or(function(a, b) {
      return a(b);
    }),

    $match: or(function(a, b) {
      if (typeof a === 'object' && typeof b === 'object') {
        return compareObjects(a, b);
      }

      return sift.compare(b, a) > 0;
    }),

    /**
     */

    $ne: and(function(a, b) {
      return !a(b);
    }),

    /**
     */

    $gt: or(function(a, b) {
      a = flComparable(a);
      b = flComparable(b);
      if (!isComparable(a, b)) {
        return false;
      }

      return sift.compare(b, a) > 0;
    }),

    /**
     */

    $gte: or(function(a, b) {
      a = flComparable(a);
      b = flComparable(b);
      if (!isComparable(a, b)) {
        return false;
      }

      return sift.compare(b, a) >= 0;
    }),

    /**
     */

    $lt: or(function(a, b) {
      a = flComparable(a);
      b = flComparable(b);
      if (!isComparable(a, b)) {
        return false;
      }

      return sift.compare(b, a) < 0;
    }),

    /**
     */

    $lte: or(function(a, b) {
      a = flComparable(a);
      b = flComparable(b);
      if (!isComparable(a, b)) {
        return false;
      }

      return sift.compare(b, a) <= 0;
    }),

    /**
     */

    $mod: or(function(a, b) {
      return b % a[0] == a[1];
    }),

    /**
     */

    $like: or(function(a, b) {
      if (typeof a === 'undefined' || typeof b === 'undefined') {
        return false;
      }
      a = String(a);
      b = String(b);

      return b.indexOf(a) > -1;
    }),

    /**
     */

    $iLike: or(function(a, b) {
      if (typeof a === 'undefined' || typeof b === 'undefined') {
        return false;
      }
      a = String(a);
      b = String(b);

      return b.toLowerCase().indexOf(a.toLowerCase()) > -1;
    }),

    /**
     */

    $in: function(a, b) {

      if (b instanceof Array) {
        for (var i = b.length; i--;) {
          if (~a.indexOf(comparable(get(b, i)))) {
            return true;
          }
        }
      } else {
        var comparableB = comparable(b);
        if (comparableB === b && typeof b === 'object') {
          for (var i = a.length; i--;) {
            if (String(a[i]) === String(b) && String(b) !== '[object Object]') {
              return true;
            }
          }
        }

        /*
          Handles documents that are undefined, whilst also
          having a 'null' element in the parameters to $in.
        */
        if (typeof comparableB == 'undefined') {
          for (var i = a.length; i--;) {
            if (a[i] == null) {
              return true;
            }
          }
        }

        /*
          Handles the case of {'field': {$in: [/regexp1/, /regexp2/, ...]}}
        */
        for (var i = a.length; i--;) {
          var validator = createRootValidator(get(a, i), undefined);
          var result = validate(validator, b, i, a);
          if ((result) && (String(result) !== '[object Object]') && (String(b) !== '[object Object]')) {
            return true;
          }
        }

        return !!~a.indexOf(comparableB);
      }

      return false;
    },

    /**
     */

    $nin: function(a, b, k, o) {
      return !OPERATORS.$in(a, b, k, o);
    },

    /**
     */

    $not: function(a, b, k, o) {
      return !validate(a, b, k, o);
    },

    /**
     */

    $type: function(a, b) {
      return b != void 0 ? b instanceof a || b.constructor == a : false;
     },

    /**
     */

    $all: function(a, b, k, o) {
      return OPERATORS.$and(a, b, k, o);
    },

    /**
     */

    $size: function(a, b) {
      return b ? a === b.length : false;
    },

    /**
     */

    $or: function(a, b, k, o) {
      for (var i = 0, n = a.length; i < n; i++) if (validate(get(a, i), b, k, o)) return true;
      return false;
    },

    /**
     */

    $nor: function(a, b, k, o) {
      return !OPERATORS.$or(a, b, k, o);
    },

    /**
     */

    $and: function(a, b, k, o) {
      for (var i = 0, n = a.length; i < n; i++) {
        if (!validate(get(a, i), b, k, o)) {
          return false;
        }
      }
      return true;
    },

    /**
     */

    $regex: or(function(a, b) {
      return typeof b === 'string' && a.test(b);
    }),

    /**
     */

    $where: function(a, b, k, o) {
      return a.call(b, b, k, o);
    },

    /**
     */

    $elemMatch: function(a, b, k, o) {
      if (isArray(b)) {
        return !!~search(b, a);
      }
      return validate(a, b, k, o);
    },

    /**
     */

    $exists: function(a, b, k, o) {
      return o.hasOwnProperty(k) === a;
    }
  };

  /**
   */

  var prepare = {

    /**
     */

    $eq: function(a) {

      if (a instanceof RegExp) {
        return function(b) {
          return typeof b === 'string' && a.test(b);
        };
      } else if (a instanceof Function) {
        return a;
      } else if (isArray(a) && !a.length) {
        // Special case of a == []
        return function(b) {
          return (isArray(b) && !b.length);
        };
      } else if (a === null){
        return function(b){
          //will match both null and undefined
          return b == null;
        }
      }

      return function(b) {
        return sift.compare(comparable(b), a) === 0;
      };
    },

    /**
     */

    $ne: function(a) {
      return prepare.$eq(a);
    },

    /**
     */

    $and: function(a) {
      return a.map(parse);
    },

    /**
     */

    $all: function(a) {
      return prepare.$and(a);
    },

    /**
     */

    $or: function(a) {
      return a.map(parse);
    },

    /**
     */

    $nor: function(a) {
      return a.map(parse);
    },

    /**
     */

    $not: function(a) {
      return parse(a);
    },

    /**
     */

    $regex: function(a, query) {
      return new RegExp(a, query.$options);
    },

    /**
     */

    $where: function(a) {
      return typeof a === 'string' ? new Function('obj', 'return ' + a) : a;
    },

    /**
     */

    $elemMatch: function(a) {
      return parse(a);
    },

    /**
     */

    $exists: function(a) {
      return !!a;
    }
  };

  /**
   */

  function search(array, validator) {

    for (var i = 0; i < array.length; i++) {
      var result = get(array, i);
      if (validate(validator, get(array, i))) {
        return i;
      }
    }

    return -1;
  }

  /**
   */

  function createValidator(a, validate) {
    return { a: a, v: validate };
  }

  /**
   */

  function nestedValidator(a, b) {
    var values  = [];
    findValues(b, a.k, 0, b, values);

    if (values.length === 1) {
      var first = values[0];
      return validate(a.nv, first[0], first[1], first[2]);
    }

    for (var i = 0; i < values.length; i++) {
      var result = values[i];
      if (validate(a.nv, result[0], result[1], result[2])) {
        return true;
      }
    }

    return false;
  }

  /**
   */

  function findValues(current, keypath, index, object, values) {

    if (index === keypath.length || current == void 0) {
      values.push([current, keypath[index - 1], object]);
      return;
    }

    var k = get(keypath, index);

    // ensure that if current is an array, that the current key
    // is NOT an array index. This sort of thing needs to work:
    // sift({'foo.0':42}, [{foo: [42]}]);
    if (isArray(current) && isNaN(Number(k))) {
      for (var i = 0, n = current.length; i < n; i++) {
        findValues(get(current, i), keypath, index, current, values);
      }
    } else {
      findValues(get(current, k), keypath, index + 1, current, values);
    }
  }

  /**
   */

  function createNestedValidator(keypath, a) {
    return { a: { k: keypath, nv: a }, v: nestedValidator };
  }

  /**
   * flatten the query
   */

  function isVanillaObject(value) {
    return value && value.constructor === Object;
  }

  function parse(query) {
    query = comparable(query);

    if (!query || !isVanillaObject(query)) { // cross browser support
      query = { $eq: query };
    }

    var validators = [];

    for (var key in query) {
      var a = query[key];

      if (key === '$options') {
        continue;
      }

      if (OPERATORS[key]) {
        if (prepare[key]) a = prepare[key](a, query);
        validators.push(createValidator(comparable(a), OPERATORS[key]));
      } else {

        if (key.charCodeAt(0) === 36) {
          throw new Error('Unknown operation ' + key);
        }

        validators.push(createNestedValidator(key.split('.'), parse(a)));
      }
    }

    return validators.length === 1 ? validators[0] : createValidator(validators, OPERATORS.$and);
  }

  /**
   */

  function createRootValidator(query, getter) {
    var validator = parse(query);
    if (getter) {
      validator = {
        a: validator,
        v: function(a, b, k, o) {
          return validate(a, getter(b), k, o);
        }
      };
    }
    return validator;
  }

  /**
   */

  function sift(query, array, getter) {

    if (isFunction(array)) {
      getter = array;
      array  = void 0;
    }

    var validator = createRootValidator(query, getter);

    function filter(b, k, o) {
      return validate(validator, b, k, o);
    }

    if (array) {
      return array.filter(filter);
    }

    return filter;
  }

  /**
   */

  sift.use = function(plugin) {
    if (isFunction(plugin)) return plugin(sift);
    for (var key in plugin) {
      /* istanbul ignore else */
      if (key.charCodeAt(0) === 36) {
        OPERATORS[key] = plugin[key];
      }
    }
  };

  /**
   */

  sift.indexOf = function(query, array, getter) {
    return search(array, createRootValidator(query, getter));
  };

  /**
   */

  sift.compare = function(a, b) {
    if(a==b) return 0;
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
  };

  /* istanbul ignore next */
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    Object.defineProperty(exports, "__esModule", {
      value: true
    });

    module.exports = sift;
    exports['default'] = module.exports.default = sift;
  }

  /* istanbul ignore next */
  if (typeof window !== 'undefined') {
    window.sift = sift;
  }
})();
