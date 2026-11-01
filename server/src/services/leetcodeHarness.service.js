import ApiError from "../utils/ApiError.js";

const cppTypes = {
  integer: "int", long: "long long", longlong: "long long", double: "double",
  float: "float", boolean: "bool", string: "string", character: "char",
};
const javaTypes = {
  integer: "int", long: "long", longlong: "long", double: "double",
  float: "float", boolean: "boolean", string: "String", character: "char",
};

function baseType(type, map) {
  const value = String(type || "").trim().toLowerCase();
  const arrays = value.match(/\[\]/g)?.length || 0;
  const name = value.replace(/\[\]/g, "").replace(/\s+/g, "");
  let result = map[name];
  if (!result) throw new ApiError(422, `LeetCode wrapper does not support parameter type "${type}" yet. Use a complete stdin program or adapt this question's input format.`);
  return { result, arrays };
}

function cppType(type) {
  const value = String(type || "").trim().replace(/\s+/g, "");
  const array = value.match(/^(.*?)(\[\])+$/);
  if (array) {
    const dimensions = value.slice(array[1].length).length / 2;
    return `${"vector<".repeat(dimensions)}${cppType(array[1])}${">".repeat(dimensions)}`;
  }
  const pair = value.match(/^pair<(.+)>$/i);
  if (pair) {
    const args = splitTemplateArgs(pair[1]);
    if (args.length === 2) return `pair<${cppType(args[0])},${cppType(args[1])}>`;
  }
  return baseType(value, cppTypes).result;
}

function splitTemplateArgs(value) {
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "<") depth++;
    else if (value[index] === ">") depth--;
    else if (value[index] === "," && depth === 0) {
      return [value.slice(0, index), value.slice(index + 1)];
    }
  }
  return [value];
}

function splitCppParameters(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "<") depth++;
    else if (value[index] === ">") depth--;
    else if (value[index] === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function javaType(type) {
  const { result, arrays } = baseType(type, javaTypes);
  return `${result}${"[]".repeat(arrays)}`;
}

function methodStyleCode(code, language) {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/^[ \t]*#.*$/gm, " ");
  return ["cpp", "java", "python", "javascript"].includes(language) && /\bclass\s+Solution\b/.test(clean);
}

function inferredType(type, language) {
  let value = String(type || "").trim().replace(/\bconst\b|\bvolatile\b|\bunsigned\b|\bsigned\b|\bstd::/g, "").replace(/[&*]/g, "").trim();
  value = value.replace(/\s+/g, " ");
  if (language === "cpp") {
    const vector = value.match(/^vector\s*<\s*(.+)\s*>$/);
    if (vector) return `${inferredType(vector[1], language)}[]`;
    const pair = value.match(/^pair\s*<\s*(.+)\s*>$/);
    if (pair) {
      const parts = splitTemplateArgs(pair[1]);
      if (parts.length === 2) {
        const first = inferredType(parts[0], language);
        const second = inferredType(parts[1], language);
        if (first && second) return `pair<${first},${second}>`;
      }
    }
  }
  if (language === "java") {
    const list = value.match(/^(?:List|ArrayList)\s*<\s*(.+)\s*>$/);
    if (list) return `${inferredType(list[1], language)}[]`;
  }
  const aliases = {
    int: "integer", "long long": "longlong", long: "long", short: "integer",
    Integer: "integer", Long: "long", Double: "double", Float: "float",
    boolean: "boolean", bool: "boolean", String: "string", string: "string",
    char: "character", Character: "character",
  };
  const array = value.match(/^(.+?)\s*(\[\])$/);
  if (array) return `${inferredType(array[1], language)}[]`;
  return aliases[value] || "";
}

function inferSignature(language, code) {
  const clean = code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/^[ \t]*#.*$/gm, " ");
  if (language === "cpp") {
    const match = clean.match(/\b((?:long\s+long|unsigned\s+long(?:\s+long)?|[\w:<>]+(?:\s*<[^;{}()]*>)?)(?:\s*[*&])?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/);
    if (!match) return null;
    const params = match[3].trim() ? splitCppParameters(match[3]).map((part) => {
      const declaration = part.trim().replace(/\s*=.*$/, "");
      const withoutName = declaration.replace(/[A-Za-z_]\w*\s*$/, "");
      return inferredType(withoutName, language);
    }) : [];
    return { method: match[2], types: params, returnType: /^void$/.test(match[1].trim()) ? "void" : inferredType(match[1], language) };
  }
  if (language === "java") {
    const match = clean.match(/\b(public\s+|protected\s+|private\s+)?(?:static\s+)?([\w<>\[\].]+)\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    if (!match) return null;
    const params = match[4].trim() ? match[4].split(",").map((part) => inferredType(part.trim().replace(/\s+\w+\s*$/, ""), language)) : [];
    return { method: match[3], types: params, returnType: match[2] === "void" ? "void" : inferredType(match[2], language) };
  }
  if (language === "python") {
    const match = clean.match(/\bdef\s+(\w+)\s*\(([^)]*)\)/);
    if (!match) return null;
    const params = match[2].trim() ? match[2].split(",").map((part) => part.trim()).filter((part) => part && !/^(self|cls)$/.test(part)).map((part) => inferredType(part.split(":")[1]?.trim() || "", language) || "json") : [];
    return { method: match[1], types: params, returnType: "" };
  }
  if (language === "javascript") {
    const match = clean.match(/(?:\b(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*\{|\bfunction\s+(\w+)\s*\(([^)]*)\))/);
    if (!match) return null;
    return { method: match[1] || match[3], types: (match[2] ?? match[4] ?? "").trim() ? (match[2] ?? match[4]).split(",").map(() => "json") : [], returnType: "" };
  }
  return null;
}

function entryPoint(question, language, code) {
  const config = question.executionConfig?.mode === "LEETCODE" ? question.executionConfig : null;
  const signature = question.starterCode?.[language] || "";
  const inputOrder = String(question.inputFormat || "").split("in this order:")[1]?.split(". Adapt")[0] || "";
  const inferred = inferSignature(language, code);
  const configuredTypes = config?.params?.map((param) => param.type).filter(Boolean);
  const types = configuredTypes?.length ? configuredTypes : inferred?.types?.length
    ? inferred.types
    :
    [...inputOrder.matchAll(/[\w]+\s+\(([^)]+)\)/g)].map((match) => match[1]);
  const fromSignature = language === "python"
    ? signature.match(/\bdef\s+(\w+)\s*\(/)?.[1]
    : language === "javascript"
      ? signature.match(/(?:\b(?:var|let|const)\s+)?(\w+)\s*=\s*function\s*\(/)?.[1] || signature.match(/\bfunction\s+(\w+)\s*\(/)?.[1]
      : signature.match(/\b(\w+)\s*\([^;{}]*\)\s*\{/g)?.map((match) => match.match(/\b(\w+)\s*\(/)?.[1]).find((name) => name && !["if", "for", "while", "switch"].includes(name));
  const method = config?.methodName || inferred?.method || fromSignature;
  if (!method || !Array.isArray(types))
    throw new ApiError(422, "This question is missing its method signature. Configure the method name and parameter types, or provide a complete stdin program.");
  if (!/^[A-Za-z_$][\w$]*$/.test(method)) throw new ApiError(422, "The imported method signature is invalid.");
  if (language === "cpp") types.forEach(cppType);
  if (language === "java") types.forEach(javaType);
  return { method, types, config, signature, inferred };
}

const cppHarness = (types, method, returnType, code) => {
  const vars = types.map((type, i) => `  ${cppType(type)} arg${i} = parseValue<${cppType(type)}>(values[${i}]);`).join("\n");
  const args = types.map((_, i) => `arg${i}`).join(", ");
  const invoke = /^void$/i.test(returnType || "")
    ? `solution.${method}(${args}); cout<<toJson(arg0)<<"\\n";`
    : `auto result=solution.${method}(${args}); cout<<toJson(result)<<"\\n";`;
  return `
#include <bits/stdc++.h>
using namespace std;
static string trimJson(string s) { auto a=s.find_first_not_of(" \\t\\r\\n"); if(a==string::npos)return ""; auto b=s.find_last_not_of(" \\t\\r\\n"); return s.substr(a,b-a+1); }
static vector<string> splitJson(const string& s) { vector<string> out; int depth=0; bool quoted=false, escaped=false; size_t start=0; for(size_t i=0;i<s.size();++i){char c=s[i]; if(quoted){if(escaped)escaped=false;else if(c=='\\\\')escaped=true;else if(c=='\\"')quoted=false;continue;} if(c=='\\"'){quoted=true;continue;} if(c=='['||c=='{')depth++; else if(c==']'||c=='}')depth--; else if(c==','&&depth==0){out.push_back(trimJson(s.substr(start,i-start)));start=i+1;}} if(start<s.size())out.push_back(trimJson(s.substr(start))); return out; }
static vector<string> splitValues(const string& s) { vector<string> raw; size_t i=0; while(i<s.size()){while(i<s.size()&&isspace((unsigned char)s[i]))i++; if(i==s.size())break; size_t start=i; if(s[i]=='['||s[i]=='{'){char open=s[i], close=open=='['?']':'}';int depth=0;bool quoted=false,escaped=false;for(;i<s.size();i++){char c=s[i];if(quoted){if(escaped)escaped=false;else if(c=='\\\\')escaped=true;else if(c=='\\"')quoted=false;continue;}if(c=='\\"'){quoted=true;continue;}if(c==open)depth++;else if(c==close&&--depth==0){i++;break;}}}else if(s[i]=='\\"'){i++;bool escaped=false;for(;i<s.size();i++){if(escaped)escaped=false;else if(s[i]=='\\\\')escaped=true;else if(s[i]=='\\"'){i++;break;}}}else{while(i<s.size()&&!isspace((unsigned char)s[i]))i++;}raw.push_back(trimJson(s.substr(start,i-start)));} vector<string> out; for(size_t j=0;j<raw.size();++j){if(j+1<raw.size()&&(raw[j+1]=="="||raw[j+1]==":")&&raw[j].find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")==string::npos){++j;continue;}out.push_back(raw[j]);} return out; }
static string unquoteJson(string s){s=trimJson(s); if(s.size()<2)return s; s=s.substr(1,s.size()-2); string o; bool e=false; for(char c:s){if(e){switch(c){case 'n':o+='\\n';break;case 'r':o+='\\r';break;case 't':o+='\\t';break;default:o+=c;}e=false;}else if(c=='\\\\')e=true;else o+=c;}return o;}
template<class T> struct IsVector : false_type {}; template<class T> struct IsVector<vector<T>> : true_type { using Value=T; }; template<class T> struct IsPair : false_type {}; template<class A,class B> struct IsPair<pair<A,B>> : true_type {};
template<class T> typename enable_if<is_same<T,string>::value,T>::type parseValue(string s){return unquoteJson(s);}
template<class T> typename enable_if<is_same<T,bool>::value,T>::type parseValue(string s){s=trimJson(s);return s=="true"||s=="1";}
template<class T> typename enable_if<is_same<T,char>::value,T>::type parseValue(string s){auto x=unquoteJson(s);return x.empty()?'\\0':x[0];}
template<class T> typename enable_if<is_arithmetic<T>::value&&!is_same<T,bool>::value&&!is_same<T,char>::value,T>::type parseValue(string s){return static_cast<T>(stold(trimJson(s)));}
template<class T> typename enable_if<IsPair<T>::value,T>::type parseValue(string s){s=trimJson(s);if(s.size()<2||s.front()!='['||s.back()!=']')throw invalid_argument("Expected a JSON pair [first, second]; enter pair arguments as [first, second]");auto parts=splitJson(s.substr(1,s.size()-2));if(parts.size()!=2)throw invalid_argument("Expected a JSON pair [first, second]; enter pair arguments as [first, second]");return T(parseValue<typename T::first_type>(parts[0]),parseValue<typename T::second_type>(parts[1]));}
template<class T> typename enable_if<IsVector<T>::value,T>::type parseValue(string s){s=trimJson(s);if(s.size()<2||s.front()!='['||s.back()!=']')throw invalid_argument("Expected a JSON array; enter each method argument as one JSON value per line");vector<typename IsVector<T>::Value> out;for(auto& x:splitJson(s.substr(1,s.size()-2)))out.push_back(parseValue<typename IsVector<T>::Value>(x));return out;}
static string escapeJson(const string& s){string o="\\\"";for(char c:s){if(c=='\\\"'||c=='\\\\')o+='\\\\';if(c=='\\n'){o+="\\\\n";continue;}if(c=='\\r'){o+="\\\\r";continue;}o+=c;}return o+"\\\"";}
static string toJson(const string& x){return escapeJson(x);} static string toJson(const char* x){return escapeJson(x?x:"");} static string toJson(char x){return escapeJson(string(1,x));} static string toJson(bool x){return x?"true":"false";}
template<class T> typename enable_if<is_arithmetic<T>::value && !is_same<T,bool>::value && !is_same<T,char>::value,string>::type toJson(T x){ostringstream o;o<<setprecision(15)<<x;return o.str();}
template<class A,class B> string toJson(const pair<A,B>& x){return "["+toJson(x.first)+","+toJson(x.second)+"]";}
template<class T> string toJson(const vector<T>& xs){string o="[";for(size_t i=0;i<xs.size();++i){if(i)o+=",";o+=toJson(static_cast<T>(xs[i]));}return o+"]";}
${code}
int main(){ios::sync_with_stdio(false);cin.tie(nullptr);vector<string> lines;string line;while(getline(cin,line))lines.push_back(line);vector<string> values;for(const auto& row:lines){auto parts=splitValues(row);values.insert(values.end(),parts.begin(),parts.end());} if(values.size()<${types.length}) return 1;
${vars}
Solution solution; ${invoke} }
`;
};

const javaHarness = (types, method, returnType, userCode) => {
  const normalizedUserCode = userCode.replace(/\bpublic\s+class\s+Solution\b/, "class Solution");
  const vars = types.map((type, i) => `    ${javaType(type)} arg${i} = (${javaType(type)}) convert(values.get(${i}), "${type}");`).join("\n");
  const args = types.map((_, i) => `arg${i}`).join(", ");
  const invoke = /^void$/i.test(returnType || "")
    ? `new Solution().${method}(${args}); System.out.println(json(arg0));`
    : `Object result = new Solution().${method}(${args}); System.out.println(json(result));`;
  return `import java.util.*;
import java.lang.reflect.Array;
${normalizedUserCode}
public class Main {
  static class Parser { String s; int i=0; Parser(String s){this.s=s;} void ws(){while(i<s.length()&&Character.isWhitespace(s.charAt(i)))i++;} Object value(){ws();char c=s.charAt(i);if(c=='\\"')return str();if(c=='['){i++;List<Object>a=new ArrayList<>();ws();if(s.charAt(i)==']'){i++;return a;}while(true){a.add(value());ws();char x=s.charAt(i++);if(x==']')return a;}}if(c=='t'){i+=4;return true;}if(c=='f'){i+=5;return false;}if(c=='n'){i+=4;return null;}int b=i++;while(i<s.length()&&"0123456789.eE+-".indexOf(s.charAt(i))>=0)i++;String n=s.substring(b,i);return n.contains(".")||n.contains("e")||n.contains("E")?Double.valueOf(n):Long.valueOf(n);} String str(){i++;StringBuilder b=new StringBuilder();while(i<s.length()){char c=s.charAt(i++);if(c=='\\"')break;if(c=='\\\\'&&i<s.length()){char e=s.charAt(i++);switch(e){case 'n':b.append('\\n');break;case 'r':b.append('\\r');break;case 't':b.append('\\t');break;default:b.append(e);}}else b.append(c);}return b.toString();}}
  static Object convert(Object v,String t){if(t.endsWith("[]")){String sub=t.substring(0,t.length()-2);List<?> xs=(List<?>)v;Class<?> c=component(sub);Object a=Array.newInstance(c,xs.size());for(int i=0;i<xs.size();i++)Array.set(a,i,convert(xs.get(i),sub));return a;} switch(t.toLowerCase()){case "integer":return ((Number)v).intValue();case "long":case "longlong":return ((Number)v).longValue();case "double":return ((Number)v).doubleValue();case "float":return ((Number)v).floatValue();case "boolean":return (Boolean)v;case "string":return (String)v;case "character":return ((String)v).charAt(0);default:throw new RuntimeException("Unsupported LeetCode type: "+t);}}
  static Class<?> component(String t){if(t.endsWith("[]"))return Array.newInstance(component(t.substring(0,t.length()-2)),0).getClass();switch(t.toLowerCase()){case "integer":return int.class;case "long":case "longlong":return long.class;case "double":return double.class;case "float":return float.class;case "boolean":return boolean.class;case "string":return String.class;case "character":return char.class;default:throw new RuntimeException("Unsupported LeetCode type: "+t);}}
  static String json(Object x){if(x==null)return "null";if(x instanceof String||x instanceof Character)return "\\\""+x.toString().replace("\\\\","\\\\\\\\").replace("\\\"","\\\\\\\"")+"\\\"";if(x instanceof Boolean||x instanceof Number)return x.toString();if(x.getClass().isArray()){StringJoiner j=new StringJoiner(",","[","]");for(int i=0;i<Array.getLength(x);i++)j.add(json(Array.get(x,i)));return j.toString();}if(x instanceof Iterable){StringJoiner j=new StringJoiner(",","[","]");for(Object y:(Iterable<?>)x)j.add(json(y));return j.toString();}return "null";}
  public static void main(String[] args){try{Scanner sc=new Scanner(System.in);List<Object> values=new ArrayList<>();while(sc.hasNextLine()){String line=sc.nextLine().trim().replaceFirst("^[A-Za-z_$][\\\\w$]*\\\\s*[:=]\\\\s*", "");if(!line.isEmpty())values.add(new Parser(line).value());}if(values.size()<${types.length})throw new RuntimeException("Expected ${types.length} input value(s)");
${vars}
    ${invoke}
  }catch(Throwable e){System.err.println(e.toString());System.exit(1);}}
}`;
};

function wrapPython(types, method, returnType, code) {
  const useMutatedInput = /^void$/i.test(returnType || "");
  return `${code}\n\nimport json as __judge_json, re as __judge_re, sys as __judge_sys\n__judge_lines = [__judge_re.sub(r"^\\s*[A-Za-z_$][\\w$]*\\s*[:=]\\s*", "", line).strip() for line in __judge_sys.stdin.read().splitlines()]\n__judge_lines = [line for line in __judge_lines if line]\nif len(__judge_lines) < ${types.length}: raise ValueError("Expected ${types.length} input value(s)")\n__judge_args = [__judge_json.loads(line) for line in __judge_lines]\n__judge_result = Solution().${method}(*__judge_args)\nif ${useMutatedInput}: __judge_result = __judge_args[0]\nprint(__judge_json.dumps(__judge_result, separators=(",", ":")))\n`;
}

function wrapJavascript(types, method, returnType, code) {
  const receiver = /\bclass\s+Solution\b/.test(code) ? `new Solution().${method}` : method;
  const invoke = /^void$/i.test(returnType || "")
    ? `${receiver}(...__judgeArgs); console.log(JSON.stringify(__judgeArgs[0]));`
    : `const __judgeResult = ${receiver}(...__judgeArgs); Promise.resolve(__judgeResult).then((value) => console.log(JSON.stringify(value)));`;
  return `${code}\n\nconst __judgeFs = require("fs");\nconst __judgeLines = __judgeFs.readFileSync(0, "utf8").split(/\\r?\\n/).map((line) => line.replace(/^\\s*[A-Za-z_$][\\w$]*\\s*[:=]\\s*/, "").trim()).filter((line) => line.length);\nif (__judgeLines.length < ${types.length}) throw new Error("Expected ${types.length} input value(s)");\nconst __judgeArgs = __judgeLines.map((line) => JSON.parse(line));\n${invoke}\n`;
}

export function prepareLeetcodeCode(question, code, language) {
  if (question.executionConfig?.mode === "STDIO") return code;
  const methodStyle = question.executionConfig?.mode === "LEETCODE";
  const isClassSolution = methodStyleCode(code, language);
  if (question.source !== "EXTERNAL" && !methodStyle && !isClassSolution) return code;
  const executableCode = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const completeProgram = language === "cpp" || language === "c"
    ? /\bmain\s*\(/.test(executableCode)
    : language === "java"
      ? /\bstatic\s+void\s+main\s*\(/.test(executableCode)
      : language === "python"
        ? /if\s+__name__\s*==\s*["']__main__["']|\bsys\.stdin\b|\binput\s*\(/.test(executableCode)
        : language === "javascript"
          ? /readFileSync\s*\(\s*0\s*\)|process\.stdin/.test(executableCode)
          : false;
  if (completeProgram) return code;
  const { method, types, config, inferred } = entryPoint(question, language, code);
  if (["cpp", "java"].includes(language) && types.some((type) => !type))
    throw new ApiError(422, "Could not infer the method parameter types. Set the method name and parameter types in the question’s LeetCode method settings.");
  const returnType = config?.returnType || inferred?.returnType || "";
  if (/^void$/i.test(returnType) && !types.length)
    throw new ApiError(422, "A void LeetCode method needs at least one mutable input parameter to compare its result.");
  if (language === "cpp") return cppHarness(types, method, returnType, code);
  if (language === "java") return javaHarness(types, method, returnType, code);
  if (language === "python") return wrapPython(types, method, returnType, code);
  if (language === "javascript") return wrapJavascript(types, method, returnType, code);
  throw new ApiError(422, `LeetCode-style method submissions are not supported for ${language}; provide a complete program with main or standard input/output.`);
}
