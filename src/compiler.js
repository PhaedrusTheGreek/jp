import { VM, NodeVM } from 'vm2';
import filter from './lib/filter';

import { merge } from 'lodash';
import requireDir from 'require-dir';

import { readFile as _readFile, createReadStream } from 'fs';
import { resolve } from 'path';

import { attempt } from 'bluebird';
import { isString, isEmpty } from 'lodash';

export class StreamScriptCompiler {

    constructor(input) {
        this._input = input;
        this._global = {};
    }

    _createSandbox() {
        return merge({
            from: path => createReadStream(resolve(process.cwd(), path)),
            select: (path, input) => {
                if (!input && !isString(path)) {
                    input = path;
                    path = null;
                }
                return filter(input || this._input,
                    `!${path || ''}`);
            }
        }, this._global);
    }

    _createVM(createVM) {
        const vm = createVM();
        const sandbox = this._createSandbox();
        Object.keys(sandbox).forEach(key => 
            vm.freeze(sandbox[key], key));
        return vm;
    }

    addGlobal(object) {
        this._global = merge({}, this._global, object || {});
        return this;
    }

    addGlobalFromPath(path) {
        return this.addGlobal(loadGlobalFromPath(path));
    }

    setInlineScript(inline) {
        this._inlineScript = inline;
        return this;
    }

    setScriptPath(path) {
        this._scriptPath = path;
        return this;
    }

    compile() {
        if (!isEmpty(this._scriptPath))
            return readFile(this._scriptPath).then(script =>
                this._createVM(() => new NodeVM({
                    require: { external: true, context: 'sandbox' }
                })).run(`'use strict';${script}`)());
        
        const inlineScript = isEmpty(this._inlineScript) ?
            'select()' : this._inlineScript;
                
        return attempt(() => this._createVM(() => new VM()).
            run(`'use strict';${inlineScript};`));
    }
}

function loadGlobalFromPath(path) {
    const vm = new NodeVM({
        sandbox: { requireDir: requireDir },
        require: { external: true, context: 'sandbox' }
    });
    return vm.run('module.exports = () => requireDir(__dirname)',
        `${path}/index.js`)();
}

function readFile(path) {
    return new Promise((resolve, reject) => {
        _readFile(path, (err, data) => {
            if (err)
                reject(err);
            else
                resolve(data.toString());
        });
    });
}