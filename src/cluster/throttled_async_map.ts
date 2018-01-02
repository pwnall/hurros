export async function throttledAsyncMap<InputType, OutputType>(
    input : InputType[], maxConcurrency : number,
    mapper: (arg : InputType) => Promise<OutputType>) : Promise<OutputType[]> {

  if (input.length === 0)
    return Promise.resolve([]);

  return new Promise<OutputType[]>((resolve, reject) => {
    let unresolved = input.length;
    let output = new Array<OutputType>(unresolved);
    let nextIndex = 0;
    let rejected = false;

    const takeNextElement = () : void => {
      const index = nextIndex;
      nextIndex += 1;
      try {
        mapper(input[index]).then((outputElement : OutputType) => {
          output[index] = outputElement;
          unresolved -= 1;
          if (unresolved === 0 && rejected === false)
            resolve(output);

          if (nextIndex < input.length && rejected === false)
            takeNextElement();
        }, (rejection) => {
          rejected = true;
          reject(rejection);
        });
      } catch (error) {
        rejected = true;
        reject(error);
      }
    };

    for (let i = Math.min(maxConcurrency, unresolved); i > 0; --i)
      takeNextElement();
  });
}
