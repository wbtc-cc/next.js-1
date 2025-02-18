import { codeFrameColumns } from 'next/dist/compiled/babel/code-frame'
import chalk from 'next/dist/compiled/chalk'
import path from 'path'

// eslint typescript has a bug with TS enums
/* eslint-disable no-shadow */
export enum DiagnosticCategory {
  Warning = 0,
  Error = 1,
  Suggestion = 2,
  Message = 3,
}

function getFormattedLinkDiagnosticMessageText(
  diagnostic: import('typescript').Diagnostic
) {
  const message = diagnostic.messageText
  if (typeof message === 'string' && diagnostic.code === 2322) {
    const match =
      message.match(
        /Type '"(.+)"' is not assignable to type 'Route<string> | URL'\./
      ) ||
      message.match(
        /Type '"(.+)"' is not assignable to type 'URL | Route<string>'\./
      )

    if (match) {
      const [, href] = match
      return `"${chalk.bold(
        href
      )}" is not an existing route. If it is intentional, please type it explicitly with \`as Route\`.`
    }
  }
}

function getFormattedLayoutAndPageDiagnosticMessageText(
  baseDir: string,
  diagnostic: import('typescript').Diagnostic
) {
  const message = diagnostic.messageText
  const sourceFilepath =
    diagnostic.file?.text.trim().match(/^\/\/ File: (.+)\n/)?.[1] || ''

  if (sourceFilepath && typeof message !== 'string') {
    const relativeSourceFile = path.relative(baseDir, sourceFilepath)
    const type = /'typeof import\(".+page"\)'/.test(message.messageText)
      ? 'Page'
      : 'Layout'

    // Reference of error codes:
    // https://github.com/Microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
    switch (message.code) {
      case 2344:
        const filepathAndType = message.messageText.match(
          /'typeof import\("(.+)"\)'.+'(.+)'/
        )
        if (filepathAndType) {
          let main = `${type} "${chalk.bold(
            relativeSourceFile
          )}" does not match the required types of a Next.js ${type}.`

          function processNext(
            indent: number,
            next?: import('typescript').DiagnosticMessageChain[]
          ) {
            if (!next) return

            for (const item of next) {
              switch (item.code) {
                case 2200:
                  const mismatchedField =
                    item.messageText.match(/The types of '(.+)'/)
                  if (mismatchedField) {
                    main += '\n' + ' '.repeat(indent * 2)
                    main += `"${chalk.bold(
                      mismatchedField[1]
                    )}" has the wrong type:`
                  }
                  break
                case 2322:
                  const types = item.messageText.match(
                    /Type '(.+)' is not assignable to type '(.+)'./
                  )
                  if (types) {
                    main += '\n' + ' '.repeat(indent * 2)

                    if (
                      types[2] === 'PageComponent' ||
                      types[2] === 'LayoutComponent'
                    ) {
                      main += `The exported ${type} component isn't correctly typed.`
                    } else {
                      main += `Expected "${chalk.bold(
                        types[2].replace(
                          '"__invalid_negative_number__"',
                          'number (>= 0)'
                        )
                      )}", got "${chalk.bold(types[1])}".`
                    }
                  }
                  break
                case 2326:
                  main += '\n' + ' '.repeat(indent * 2)
                  main += `Invalid configuration:`
                  break
                case 2739:
                  const invalidProp = item.messageText.match(
                    /Type '(.+)' is missing the following properties from type '(.+)'/
                  )
                  if (invalidProp) {
                    if (
                      invalidProp[1] === 'LayoutProps' ||
                      invalidProp[1] === 'PageProps'
                    ) {
                      main += '\n' + ' '.repeat(indent * 2)
                      main += `Prop "${invalidProp[2]}" is incompatible with the ${type}.`
                    }
                  }
                  break
                case 2559:
                  const invalid = item.messageText.match(/Type '(.+)' has/)
                  if (invalid) {
                    main += '\n' + ' '.repeat(indent * 2)
                    main += `Type "${chalk.bold(invalid[1])}" isn't allowed.`
                  }
                  break
                case 2741:
                  const incompatPageProp = item.messageText.match(
                    /Property '(.+)' is missing in type 'PageProps'/
                  )
                  if (incompatPageProp) {
                    main += '\n' + ' '.repeat(indent * 2)
                    main += `Prop "${chalk.bold(
                      incompatPageProp[1]
                    )}" will never be passed. Remove it from the component's props.`
                  } else {
                    const extraLayoutProp = item.messageText.match(
                      /Property '(.+)' is missing in type 'LayoutProps' but required in type '(.+)'/
                    )
                    if (extraLayoutProp) {
                      main += '\n' + ' '.repeat(indent * 2)
                      main += `Prop "${chalk.bold(
                        extraLayoutProp[1]
                      )}" is not valid for this Layout, remove it to fix.`
                    }
                  }
                  break
                default:
              }

              processNext(indent + 1, item.next)
            }
          }

          processNext(1, message.next)
          return main
        }
        break
      case 2345:
        const filepathAndInvalidExport = message.messageText.match(
          /'typeof import\("(.+)"\)'.+Impossible<"(.+)">/
        )
        if (filepathAndInvalidExport) {
          const main = `${type} "${chalk.bold(
            relativeSourceFile
          )}" exports an invalid "${chalk.bold(
            filepathAndInvalidExport[2]
          )}" field. ${type} should only export a default React component and configuration options. Learn more: https://nextjs.org/docs/messages/invalid-segment-export`
          return main
        }
        break
      default:
    }
  }
}

export async function getFormattedDiagnostic(
  ts: typeof import('typescript'),
  baseDir: string,
  distDir: string,
  diagnostic: import('typescript').Diagnostic,
  isAppDirEnabled?: boolean
): Promise<string> {
  // If the error comes from .next/types/, we handle it specially.
  const isLayoutOrPageError =
    isAppDirEnabled &&
    diagnostic.file?.fileName.startsWith(path.join(baseDir, distDir, 'types'))

  let message = ''

  const linkReason = getFormattedLinkDiagnosticMessageText(diagnostic)
  const layoutReason =
    !linkReason && isLayoutOrPageError
      ? getFormattedLayoutAndPageDiagnosticMessageText(baseDir, diagnostic)
      : null
  const reason =
    linkReason ||
    layoutReason ||
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  const category = diagnostic.category
  switch (category) {
    // Warning
    case DiagnosticCategory.Warning: {
      message += chalk.yellow.bold('Type warning') + ': '
      break
    }
    // Error
    case DiagnosticCategory.Error: {
      message += chalk.red.bold('Type error') + ': '
      break
    }
    // 2 = Suggestion, 3 = Message
    case DiagnosticCategory.Suggestion:
    case DiagnosticCategory.Message:
    default: {
      message += chalk.cyan.bold(category === 2 ? 'Suggestion' : 'Info') + ': '
      break
    }
  }

  message += reason + '\n'

  if (!isLayoutOrPageError && diagnostic.file) {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
    const line = pos.line + 1
    const character = pos.character + 1

    let fileName = path.posix.normalize(
      path.relative(baseDir, diagnostic.file.fileName).replace(/\\/g, '/')
    )
    if (!fileName.startsWith('.')) {
      fileName = './' + fileName
    }

    message =
      chalk.cyan(fileName) +
      ':' +
      chalk.yellow(line.toString()) +
      ':' +
      chalk.yellow(character.toString()) +
      '\n' +
      message

    message +=
      '\n' +
      codeFrameColumns(
        diagnostic.file.getFullText(diagnostic.file.getSourceFile()),
        {
          start: { line: line, column: character },
        },
        { forceColor: true }
      )
  }

  return message
}
