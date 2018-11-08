'use strict';

import { Observable } from 'rxjs';
import input from './input';

export default (stream, path, options) => 
    Observable.create(observer =>
        input(stream, path, node => observer.next(node), options).
            then(() => observer.complete()).
            catch(err => observer.error(err)));
