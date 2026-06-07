import google.generativeai as genai
import sys

def test_gemini():
    try:
        genai.configure(api_key='AIzaSyBOKWVsGm6_eIaHQWVdZRRrMCBgDraLNYc')
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content('Hi')
        print(f"SUCCESS: {response.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    test_gemini()
