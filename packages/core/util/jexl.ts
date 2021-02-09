import jexl from 'jexl'
import { Feature } from './simpleFeature'

// main notes will go here for jexl

// this will contain the default jexl from https://github.com/TomFrost/Jexl
// here, we will add any helper functions that jexl will need with jexl.addFunction
// then in other files, they can import this custom jexl with added helper functions

// other files that will need to be used: functionStrings.ts, configurationSlot.ts, core/util.ts, maybe CallbackEditor.js
// and any files that have function strings in their default config scheme

// how the flow of data works:
// 1. user edits the default 'jexl string' using the config slot callback editor
// 2. default will look like 'jexl: getFeatureData()', edit will be like 'jexl: getFeatureData(feature, 'strand') == "+" ? 'blue' : 'red'. jexl: part will not be edited
// 3. the string will be passed to function strings. on line ~53 instead of new function it will be like jexl.createExpression(('textFromEditor || default').remove('jexl:'))
// 4. the return of this will be used in configurationSlot where stringToFunction is called. There will be an edited isCallback() function that checks for the jexl: string to
//    make sure that the string is supposed to be a jexl function
// 5. in utils.js is where readConfig is called. When the function is passed there, jexl.eval(args) will be called, where args is the created jexl expression from above

// Still left TODO:
// make special function editing area that is not applied or saved to sessions, these are solely for adding to jexl, maybe have a GUI editor so they can manage functions
// create jexl function that adds core + adds config functions and returns new jexl
// for slot editor, when the slot can be a callback, have a  ? info icon that can be clicked which links to the Jexl repo, maybe on mousehover have explaination of why jexl

// below are core functions
jexl.addFunction('getFeatureData', (feature: Feature, data: string) => {
  return feature.get(data)
})
// ask if feature.get(id) is same as feature.id()
jexl.addFunction('getFeatureId', (feature: Feature) => {
  return feature.id()
})
jexl.addFunction(
  'switchCase',
  (cases: string[], toReturn: string[], matchingCase: string) => {
    // cases.forEach((case, idx) => {
    //   if(case === matchingCase) return toReturn[index]
    // })
    for (let i = 0; i < cases.length; i++) {
      if (cases[i] === matchingCase) return toReturn[i]
    }
    return toReturn[toReturn.length - 1]
  },
)
// eslint-disable-next-line no-bitwise
jexl.addBinaryOp('&', 15, (a: number, b: number) => a & b)

// dynamically add any functions needed in the jbrowse namespace
// something like the following:
// if window.JBrowseFunctions && isObject(window.JBrowseFunctions) foreach Object.entries(window.JBrowseFunctions) jexl.addFuntion(...)
// { functionName: "function()...", ... }

// export default a function that takes config and adds core functions, then adds the config functions and returns new jexl.Jexl() so they are isolated from each other
// A reference to the Jexl constructor. To maintain separate instances of Jexl with each maintaining its own set of transforms, simply re-instantiate with new jexl.Jexl().

function createJexlInstance(/* config?: any*/) {
  // someday will make sure all of configs callbacks are added in, including ones passed in
  return jexl
}

export default createJexlInstance
