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
            requireDir: requireDir,
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
        const sandbox = this._createSandbox();
        const vm = createVM(sandbox);
        /*Object.keys(sandbox).forEach(key => 
            vm.freeze(sandbox[key], key));*/
        return vm;
    }

    addGlobal(object) {
        this._global = merge({}, this._global, object || {});
        return this;
    }

    addGlobalFromPath(path) {
        return this.addGlobal(this._loadPath(path));
    }

    setInlineScript(inline) {
        this._inlineScript = inline;
        return this;
    }

    setCommand(command) {
        this._command = command;
        return this;
    }

    setCommandArgs(args) {
        this._commandArgs = args;
        return this;
    }

    setCommandsPath(path) {
        this._commandsPath = path;
        return this;
    }

    compile() {
        if (!isEmpty(this._command)) {
            const commandFile = resolve(this._commandsPath, `${this._command}.js`);
            return attempt(() => this._createVM((sandbox) => new NodeVM({
                sandbox: sandbox,
                require: { external: true, context: 'sandbox' }
            })).run(`'use strict';
                const command = require('${commandFile}');
                module.exports = (argv) => command(argv)`,
            commandFile)(this._commandArgs || {}));
        }
        
        const inlineScript = isEmpty(this._inlineScript) ?
            'select()' : this._inlineScript;
                
        return attempt(() => this._createVM((sandbox) => new VM({
            sandbox: sandbox
        })).run(`'use strict';${inlineScript};`));
    }

    _loadPath(path) {
        return this._createVM((sandbox) => new NodeVM({
            sandbox: sandbox,
            require: { external: true, context: 'sandbox' }
        })).run(`'use strict';
            module.exports = () =>
                requireDir('${path}', { 
                    recurse: true 
                })`, `${path}/index.js`)();
    }
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