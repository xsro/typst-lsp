import * as fs  from 'fs';
import * as readline  from 'readline';

export function getLastLine(fileName:string, minLength:number):Promise<string> {
    const  inStream = fs.createReadStream(fileName);
    return new Promise((resolve, reject)=> {
        const rl = readline.createInterface(inStream);

        let lastLine = '';
        rl.on('line', function (line) {
            if (line.length >= minLength) {
                lastLine = line;
            }
        });

        rl.on('error', reject)

        rl.on('close', function () {
            resolve(lastLine)
        });
    })
}