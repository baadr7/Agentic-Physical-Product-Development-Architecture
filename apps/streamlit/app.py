import os, requests, jwt, streamlit as st

API_BASE = os.getenv('API_BASE', 'http://127.0.0.1:8001')

st.set_page_config(page_title='Makerkit PoC', layout='wide')
st.title('Makerkit Streamlit PoC')

jwt_token = st.text_input('JWT Token (paste raw token)', value=os.getenv('JWT',''))
headers = {}
if jwt_token:
    headers['Authorization'] = f'Bearer {jwt_token}'

st.sidebar.header('Navigation')
page = st.sidebar.radio('Page', ['Projects','New Run','Variants'])

session = requests.Session()

if page == 'Projects':
    st.subheader('Projects')
    if st.button('Refresh Projects'):
        resp = session.get(f'{API_BASE}/api/v1/projects', headers=headers)
        if resp.ok:
            data = resp.json()
            st.success(f'Fetched {len(data)} projects')
            for p in data:
                with st.expander(p.get('title') or p.get('id')):
                    st.json(p)
        else:
            st.error(f'Error {resp.status_code}: {resp.text}')

elif page == 'New Run':
    st.subheader('Create Run')
    project_id = st.text_input('Project ID')
    description = st.text_area('Description (optional)')
    if st.button('Create Run'):
        payload = {'project_id': project_id, 'description': description, 'skip_processing': True}
        resp = session.post(f'{API_BASE}/api/v1/runs', json=payload, headers=headers)
        if resp.ok:
            st.success('Run created')
            st.json(resp.json())
        else:
            st.error(f'Error {resp.status_code}: {resp.text}')

elif page == 'Variants':
    st.subheader('Variants for Run')
    run_id = st.text_input('Run ID')
    if st.button('Load Variants'):
        resp = session.get(f'{API_BASE}/api/v1/runs/{run_id}/variants', headers=headers)
        if resp.ok:
            data = resp.json()
            st.success(f'{len(data)} variants')
            for v in data:
                with st.expander(v.get('id')):
                    img_url = v.get('image_url')
                    if img_url and img_url.startswith('data:image'):
                        st.image(img_url)
                    else:
                        st.write('Image URL:', img_url)
                    st.json(v)
        else:
            st.error(f'Error {resp.status_code}: {resp.text}')
