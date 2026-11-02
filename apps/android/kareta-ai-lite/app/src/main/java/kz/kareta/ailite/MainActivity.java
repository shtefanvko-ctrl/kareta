package kz.kareta.ailite;
import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.net.*;
import java.io.*;
import javax.net.ssl.*;

public final class MainActivity extends Activity {
 static final String HOST="https://kareta.kz";
 static final int BG=Color.rgb(9,15,33), FG=Color.WHITE, CYAN=Color.rgb(63,207,230);
 LinearLayout body,lines; ScrollView chatScroll; TextView notice; EditText phone,code,question; Button submit,confirm;
 String session=null,model=null,conversationId=null,challengeKey=null;
 final java.util.LinkedHashMap<String,String> cookies=new java.util.LinkedHashMap<>();
 JSONArray transcript=new JSONArray();
 boolean busy=false;
 interface Job {void execute() throws Exception;}
 int dp(int a){return (int)(a*getResources().getDisplayMetrics().density+.5f);}
 TextView txt(String s,int size,int color){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(color);return t;}
 void page(String subtitle){
  ScrollView outer=new ScrollView(this);outer.setFillViewport(true);outer.setBackgroundColor(BG);
  body=new LinearLayout(this);body.setOrientation(1);body.setPadding(dp(18),dp(20),dp(18),dp(18));
  outer.addView(body);setContentView(outer);
  TextView h=txt("KARETA AI",27,CYAN);h.setTypeface(null,Typeface.BOLD);body.addView(h);
  TextView subt=txt(subtitle,14,FG);subt.setPadding(0,dp(4),0,dp(12));body.addView(subt);
  notice=txt("",13,Color.rgb(255,211,134));body.addView(notice);
 }
 Button button(String name,View.OnClickListener run){
  Button b=new Button(this);b.setText(name);b.setOnClickListener(run);
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(52));lp.topMargin=dp(9);body.addView(b,lp);return b;
 }
 EditText entry(String hint,boolean secret){
  EditText e=new EditText(this);e.setHint(hint);e.setTextColor(FG);e.setHintTextColor(Color.LTGRAY);
  e.setSingleLine(true);
  e.setInputType(secret?InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD:InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
  body.addView(e,new LinearLayout.LayoutParams(-1,dp(55)));return e;
 }
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);loginScreen();}
 void loginScreen(){
  session=null;model=null;conversationId=null;challengeKey=null;transcript=new JSONArray();busy=false;submit=null;
  synchronized(cookies){cookies.clear();}
  page("Lite · Android 4.4+ · вход через WhatsApp KARETA");
  TextView info=txt("Личные диалоги. Номер подтверждается сервером KARETA; коды выдаёт только подключённый OTP-провайдер.",14,FG);
  info.setPadding(0,dp(9),0,dp(12));body.addView(info);
  phone=entry("Номер телефона +7...",false);phone.setInputType(InputType.TYPE_CLASS_PHONE);
  button("Получить код WhatsApp",v->requestCode());
  code=entry("Код из WhatsApp",false);code.setInputType(InputType.TYPE_CLASS_NUMBER);code.setVisibility(View.GONE);
  confirm=button("Подтвердить код",v->verifyCode());confirm.setVisibility(View.GONE);
  button("Проверить сервер",v->work(()->{
   JSONObject r=api("GET","/api/identity_session.php?action=current",null);
   runOnUiThread(()->notice.setText("Связь с kareta.kz: PASS, текущая сессия: "+(r.optBoolean("authenticated")?"подтверждена":"нет входа")));
  }));
  TextView tip=txt("Административная учётная запись и чужие чаты в Lite не используются.",12,Color.LTGRAY);
  tip.setPadding(0,dp(12),0,0);body.addView(tip);
 }
 void work(Job task){
  new Thread(()->{try{task.execute();}catch(Exception e){
   String msg=e.getMessage()==null?e.toString():e.getMessage();
   runOnUiThread(()->{if(notice!=null)notice.setText(msg.length()>210?msg.substring(0,210):msg);busy=false;if(submit!=null)submit.setEnabled(true);});
  }},"kareta-lite-network").start();
 }
 void requestCode(){
  String number=phone.getText().toString().trim();
  if(number.length()<10){notice.setText("Укажи корректный телефон.");return;}
  notice.setText("Запрашиваю код WhatsApp...");
  work(()->{
   JSONObject request=new JSONObject().put("action","requestCode").put("phone",number);
   JSONObject response=api("POST","/api/identity_session.php",request);
   challengeKey=response.optString("challengeKey",null);
   if(challengeKey==null||challengeKey.length()<16)throw new IOException("Сервер не выдал запрос подтверждения");
   runOnUiThread(()->{code.setVisibility(View.VISIBLE);confirm.setVisibility(View.VISIBLE);notice.setText("Введи полученный код из WhatsApp.");});
  });
 }
 void verifyCode(){
  if(challengeKey==null){notice.setText("Сначала запроси код.");return;}
  String otp=code.getText().toString().trim();
  if(otp.length()<4||otp.length()>8){notice.setText("Код должен содержать 4–8 цифр.");return;}
  notice.setText("Проверяю код...");
  work(()->{
   JSONObject request=new JSONObject().put("action","verifyCode").put("challengeKey",challengeKey).put("code",otp);
   JSONObject response=api("POST","/api/identity_session.php",request);
   if(!response.optBoolean("authenticated",false))throw new IOException("Авторизация не подтверждена");
   session="verified";challengeKey=null;
   JSONObject state=api("GET","/api/ai_chat.php?action=status",null);
   model=state.optString("model","KARETA AI");
   runOnUiThread(()->chatScreen());
  });
 }
 void logOut(){
  work(()->{
   try{api("POST","/api/identity_session.php",new JSONObject().put("action","logout"));}
   catch(Exception ignored){}
   runOnUiThread(()->loginScreen());
  });
 }
 void chatScreen(){
  page("Модель: "+model);
  button("Выйти",v->logOut());
  chatScroll=new ScrollView(this);lines=new LinearLayout(this);lines.setOrientation(1);
  chatScroll.addView(lines);body.addView(chatScroll,new LinearLayout.LayoutParams(-1,dp(320)));
  question=new EditText(this);question.setTextColor(FG);question.setHintTextColor(Color.LTGRAY);question.setHint("Сообщение");question.setSingleLine(false);question.setMinLines(2);
  body.addView(question,new LinearLayout.LayoutParams(-1,-2));
  submit=button("Отправить",v->send());
  addLine("KARETA AI","Защищённый чат. История этого запуска хранится только в памяти.");
 }
 void addLine(String who,String msg){
  TextView line=txt(who+"\n"+msg,15,FG);line.setPadding(dp(12),dp(12),dp(12),dp(12));
  line.setBackgroundColor(who.equals("Вы")?Color.rgb(24,58,75):Color.rgb(33,30,65));
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(7);lines.addView(line,lp);
  chatScroll.post(()->chatScroll.fullScroll(View.FOCUS_DOWN));
 }
 void send(){
  if(busy||session==null)return;
  final String text=question.getText().toString().trim();
  if(text.length()==0||text.length()>1500){notice.setText("Не более 1500 символов.");return;}
  busy=true;submit.setEnabled(false);question.setText("");addLine("Вы",text);notice.setText("Модель отвечает...");
  final String capturedSession=session;
  work(()->{
   JSONObject req=new JSONObject().put("message",text);
   if(conversationId!=null)req.put("conversationId",conversationId);
   JSONObject response=api("POST","/api/ai_chat.php?action=send",req);
   final String answer=response.optString("answer","");
   final String newId=response.optString("conversationId","");
   if(answer.length()==0||newId.length()!=32)throw new IOException("Некорректный ответ AI API");
   runOnUiThread(()->{
    if(!capturedSession.equals(session))return;
    conversationId=newId;addLine("KARETA AI",answer);
    notice.setText("");busy=false;submit.setEnabled(true);
   });
  });
 }
 JSONObject message(String role,String content){JSONObject x=new JSONObject();try{x.put("role",role);x.put("content",content);}catch(JSONException ignored){}return x;}
 JSONObject api(String method,String path,JSONObject payload)throws Exception{
  HttpsURLConnection c=(HttpsURLConnection)new URL(HOST+path).openConnection();
  c.setSSLSocketFactory(new Tls12Factory((SSLSocketFactory)SSLSocketFactory.getDefault()));
  c.setConnectTimeout(12000);c.setReadTimeout(45000);c.setRequestMethod(method);
  c.setRequestProperty("Accept","application/json");
  c.setRequestProperty("User-Agent","KARETA-AI-Lite-Android4/1.0.0.2");
  synchronized(cookies){
   if(!cookies.isEmpty()){
    StringBuilder b=new StringBuilder();
    for(java.util.Map.Entry<String,String> e:cookies.entrySet()){
     if(b.length()>0)b.append("; ");
     b.append(e.getKey()).append("=").append(e.getValue());
    }
    c.setRequestProperty("Cookie",b.toString());
   }
  }
  if(path.startsWith("/api/ai_chat.php"))c.setRequestProperty("X-Kareta-AI-Client","1");
  if(payload!=null){
   c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json; charset=utf-8");
   byte[] bytes=payload.toString().getBytes("UTF-8");
   c.setFixedLengthStreamingMode(bytes.length);
   OutputStream out=c.getOutputStream();out.write(bytes);out.close();
  }
  try{
   int status=c.getResponseCode();
   java.util.Map<String,java.util.List<String>> headers=c.getHeaderFields();
   if(headers!=null)for(java.util.Map.Entry<String,java.util.List<String>> e:headers.entrySet()){
    if(e.getKey()!=null&&e.getKey().equalsIgnoreCase("Set-Cookie")){
     for(String item:e.getValue()){
      String part=item.split(";",2)[0];int eq=part.indexOf('=');
      if(eq>0){
       String key=part.substring(0,eq),value=part.substring(eq+1);
       if(key.matches("[A-Za-z0-9_]{1,80}")&&value.matches("[A-Za-z0-9%_.-]{0,256}")){
        synchronized(cookies){if(value.isEmpty())cookies.remove(key);else cookies.put(key,value);}
       }
      }
     }
    }
   }
   if(status==403)throw new IOException("HTTP 403: Cloudflare или доступ запрещён");
   if(status==401)throw new IOException("HTTP 401: требуется новый вход");
   InputStream in=status>=400?c.getErrorStream():c.getInputStream();
   if(in==null)throw new IOException("HTTP "+status);
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   byte[] chunk=new byte[4096];int n;
   while((n=in.read(chunk))!=-1){bytes.write(chunk,0,n);if(bytes.size()>1000000)throw new IOException("Ответ слишком большой");}
   in.close();String text=new String(bytes.toByteArray(),"UTF-8");
   if(status<200||status>=300){
    try{JSONObject problem=new JSONObject(text);throw new IOException("HTTP "+status+": "+problem.optString("error","server_unavailable"));}
    catch(JSONException invalid){throw new IOException("HTTP "+status);}
   }
   try{return new JSONObject(text);}catch(Exception e){throw new IOException("Сервер не вернул JSON");}
  }finally{c.disconnect();}
 }
 @Override public void onBackPressed(){
  if(session==null){super.onBackPressed();return;}
  new AlertDialog.Builder(this).setTitle("Выйти из KARETA AI?").setMessage("Завершить сеанс и очистить историю?")
   .setNegativeButton("Отмена",null).setPositiveButton("Выйти",(dialog,which)->logOut()).show();
 }
 static final class Tls12Factory extends SSLSocketFactory{
  final SSLSocketFactory d;Tls12Factory(SSLSocketFactory f){d=f;}
  Socket tls(Socket s){if(s instanceof SSLSocket){SSLSocket x=(SSLSocket)s;for(String p:x.getSupportedProtocols())if("TLSv1.2".equals(p)){x.setEnabledProtocols(new String[]{"TLSv1.2"});break;}}return s;}
  public String[] getDefaultCipherSuites(){return d.getDefaultCipherSuites();}
  public String[] getSupportedCipherSuites(){return d.getSupportedCipherSuites();}
  public Socket createSocket(Socket s,String h,int p,boolean a)throws IOException{return tls(d.createSocket(s,h,p,a));}
  public Socket createSocket(String h,int p)throws IOException{return tls(d.createSocket(h,p));}
  public Socket createSocket(String h,int p,InetAddress l,int lp)throws IOException{return tls(d.createSocket(h,p,l,lp));}
  public Socket createSocket(InetAddress h,int p)throws IOException{return tls(d.createSocket(h,p));}
  public Socket createSocket(InetAddress h,int p,InetAddress l,int lp)throws IOException{return tls(d.createSocket(h,p,l,lp));}
 }
}