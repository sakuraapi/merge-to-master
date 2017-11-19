export function print(msg: any[] | string, color: string, spaces?: number) {

  if (spaces) {
    process.stdout.write(' '.repeat(spaces));
  }

  if (!Array.isArray(msg)) {
    msg = [msg];
  }

  msg[0] = `${msg[0]}`[color];

  console.log((msg as Array<any>).shift(), ...msg);
}

export function info(msg: any[] | string, spaces?: number) {
  print(msg, 'green', spaces);
}

export function warn(msg: any[] | string, spaces?: number) {
  print(msg, 'yellow', spaces);
}

export function error(msg: any[] | string, exitCode: number = 1, spaces?: number) {
  print(msg, 'red', spaces);
  process.exit(exitCode);
}

export function notice(msg: any[] | string, spaces?: number) {
  print(msg, 'cyan', spaces);
}

export function message(msg: any[] | string, spaces?: number) {
  print(msg, 'white', spaces);
}
