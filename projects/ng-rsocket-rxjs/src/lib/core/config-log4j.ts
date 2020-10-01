

export enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
    Never = 10,
}

export enum LogTarget {
    Console,
}

export class Logger {

    private _level: LogLevel = LogLevel.Never;

    constructor(public readonly name: string) {

    }

    public debug(msg: string, error?: Error) {
        this.log(LogLevel.Debug, msg, error)
    }
    public error(msg: string, error?: Error) {
        this.log(LogLevel.Error, msg, error)
    }

    public info(msg: string, error?: Error) {
        this.log(LogLevel.Info, msg, error)
    }
    public trace(msg: string, error?: Error) {
        this.log(LogLevel.Trace, msg, error)
    }

    public warn(msg: string, error?: Error) {
        this.log(LogLevel.Warn, msg, error)
    }


    private log(level: LogLevel, msg: string, error?: Error) {
        if (level >= this._level) {
            console.log(`LOG - '${new Date(Date.now()).toISOString()}' - ${this.levelToString(level)} [${this.name}] ${msg} ${error != undefined ? JSON.stringify(error) : ''}`);
        }
    }

    public setLevel(level: LogLevel) {
        this._level = level;
    }

    private levelToString(level: LogLevel): string {
        switch (level) {
            case LogLevel.Debug:
                return 'DEBUG';
            case LogLevel.Error:
                return 'ERROR';
            case LogLevel.Info:
                return 'INFO';
            case LogLevel.Trace:
                return 'TRACE';
            case LogLevel.Warn:
                return 'WARN';
            case LogLevel.Never:
            default:
                return 'WTF';
        }
    }

}

export class LogFactory {


    private _logger: Logger[] = [];
    private _levels: Map<RegExp, LogLevel> = new Map();

    public getLogger(name: string) {
        return this.createLogger(name);
    }

    public setLevel(level: LogLevel, selector?: RegExp) {
        if (selector != undefined) {
            this._levels.set(selector, level);

        } else {
            const currentSelectors = this._levels.keys();
            this._levels.clear();
            for (let selector of currentSelectors) {
                this._levels.set(selector, level);
            }
        }
        this.updateLevels();

    }

    private createLogger(name: string): Logger {
        const logger = new Logger(name);
        this._logger.push(logger);
        logger.setLevel(LogLevel.Info);
        this.updateLevels();
        return logger;
    }

    private updateLevels() {
        const currentSelectors = Array.from(this._levels.keys()).sort((a, b) => a.source.length - b.source.length);
        for (let selector of currentSelectors) {
            this._logger.filter(s => s.name.match(selector) != null).forEach(logger => logger.setLevel(this._levels.get(selector)));
        }
    }

}


export const factory = new LogFactory();


factory.setLevel(LogLevel.Debug, /^\.protocol/);
factory.setLevel(LogLevel.Debug, /.*/);