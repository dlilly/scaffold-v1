let credentials = {}
let endpoints = []

let template = {
    client_id: '',
    client_secret: '',
    oauth_url: '',
    api_url: '',
    scopes: []
}

function onSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
    console.log('Name: ' + profile.getName());
    console.log('Image URL: ' + profile.getImageUrl());
    console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
    document.getElementById('name').innerHTML = profile.getName()
    refreshCredentials()
}

let refreshCredentials = async () => {
    credentials = await $.ajax('/api/projects')
    endpoints = await $.ajax('/api')

    console.log(`endpoints ${JSON.stringify(endpoints, '', 4)}`)

    let groupedCredentials = _.groupBy(credentials, 'region')
    let html = ''
    _.each(Object.keys(groupedCredentials), group => {
        let regionCreds = groupedCredentials[group]
        html += `<ul>`
        html += `<li class='list-group-item region'>${group}</li>`
        _.each(regionCreds, cred => {
            html += `<li class='project list-group-item' onclick='clickRow("${cred.projectKey}")'>${cred.projectKey}</li>`
        })
        html += `</ul>`
    })
    $('#credentialsList').html(html)
}

$(document).on('click', '.toggle-switch', async function () {
    $(this).blur()

    let serviceKey = $(this).data('key')
    let serviceType = $(this).data('type')
    let serviceActive = $(this).data('active')
    let projectKey = $(this).data('project-key')

    let url = `/api/${serviceType}${serviceActive ? '?key=' + serviceKey : ''}`
    let method = serviceActive ? 'delete' : 'post'

    let request = {
        url,
        method,
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        headers: { 'Authorization': projectKey }
    }

    request.data = serviceActive ? null : JSON.stringify({
        project: projectKey,
        key: serviceKey,
        protocol: window.location.protocol.replace(':', ''),
        host: window.location.host
    })

    await $.ajax(request)
    clickRow(projectKey)
})

let clickRow = async projectKey => {
    let project = await $.ajax({
        url: '/api/project',
        headers: { 'Authorization': projectKey }
    })

    let byModule = {}
    _.each(_.filter(endpoints, 'key'), endpoint => {
        let services = _.flatten(_.concat([], Object.values(project)))
        if (_.includes(Object.keys(project), endpoint.type)) {
            endpoint.active = _.includes(_.map(services, 'key'), endpoint.key)
            endpoint.activeHTML = `
                <input class="toggle" type="checkbox" ${endpoint.active ? 'checked' : ''} id='toggle-${endpoint.key}'/>
                <button class='toggle-switch' data-project-key='${projectKey}' data-key='${endpoint.key}' data-type='${endpoint.type}' data-active='${endpoint.active}'>Toggle</button>
            `
        }
        else {
            endpoint.active = false
            endpoint.activeHTML = ''
        }

        if (endpoint.module) {
            byModule[endpoint.module] = byModule[endpoint.module] || []
            byModule[endpoint.module].push(endpoint)
        }
    })

    let html = ''
    _.each(Object.keys(byModule), module => {
        let endpoints = byModule[module]
        let services = _.filter(endpoints, endpoint => endpoint.type === 'extensions' || endpoint.type === 'subscribers')

        if (services.length > 0) {
            html += `<ul>`
            html += `<li class='list-group-item module'>${module}</li>`
            _.each(services, endpoint => {
                html += `
                    <li class='project list-group-item')'>
                        <div class='row'>
                            <div class='col col-md-6'>${endpoint.key}</div>
                            <div class='col col-md-4'>${endpoint.type}</div>
                            <div class='col col-md-2'>${endpoint.activeHTML}</div>
                        </div>
                    </li>
                `
            })
            html += `</ul>`
        }
    })

    $('#credentialDetailServices').html(html)
    $('#credentialTitle').text(projectKey)
    $('#credentialDetail').fadeIn(200)
}

let showCredentialCreate = () => {
    $('#saveCredentialButton').prop('disabled', true)

    $('#credentialCreate .form-control').val('')
    $('#credentialCreate .form-control').removeClass('error success')

    $('#credentialCreate').fadeIn(200, async () => {
        let clipped = await navigator.clipboard.readText()
        if (clipped.indexOf('commercetools.com') > -1) {
            $('#pastedCredentials').val(clipped)
            parseCredentialPaste()
        }
        else {
            $('#pastedCredentials').focus()
        }
    })
}

let parseCredentialPaste = () => {
    let pasted = $('#pastedCredentials').val()
    let credential = {}

    _.each(Object.keys(template), key => {
        $(`#field_${key}`).removeClass('error success')
    })

    if (_.isEmpty(pasted)) {
        return
    }

    _.each(pasted.split('\n'), line => {
        line = line.replace(' = ', '=')
        line = line.replace(/"/g, '')
        line = line.replace(/^ +/, '')

        // environment variables
        line = line.replace('export CTP_', '')

        let splitchar = line.indexOf(': ') > -1 ? ': ' : '='
        let [key, value] = line.split(splitchar)

        // java properties
        key = key.replace('ctp.', '')

        // sunrise spa
        key = key.replace('VUE_APP_CT_', '')
        key = key.replace('HOST', 'URL')
        key = key.toLowerCase()

        console.log(`key ${key}`)

        let templateKey = findTemplateKey(key)
        if (templateKey) {
            credential[templateKey] = value
        }
    })

    $('#field_client_id').val(credential.client_id)
    $('#field_client_secret').val(credential.client_secret)
    $('#field_oauth_url').val(credential.oauth_url)
    $('#field_api_url').val(credential.api_url)
    $('#field_scopes').val(credential.scopes)    

    _.each(Object.keys(template), key => {
        console.log(`empty ${key}? ${_.isEmpty(credential[key])}`)
        if (_.isEmpty(credential[key])) {
            $(`#field_${key}`).addClass('error')
        }
        else {
            $(`#field_${key}`).addClass('success')
        }
    })

    let mismatches = matchesTemplate(credential)
    if (mismatches.length === 0) {
        $('#saveCredentialButton').prop('disabled', false)
    }
    else {
        $('#saveCredentialButton').prop('disabled', true)
        console.log(`mismatches: ${JSON.stringify(mismatches)}`)
    }
}

let saveCredential = async () => {
    let credential = {
        project:        getProjectKeyFromScopes(),
        client_id:      $('#field_client_id').val(),
        client_secret:  $('#field_client_secret').val(),
        oauth_url:      $('#field_oauth_url').val(),
        api_url:        $('#field_api_url').val(),
        scopes:         $('#field_scopes').val().split(' ')
    }

    if (!credentials[credential.project] || (credentials[credential.project] && confirm(`Project ${credential.project} already has credentials in the vault; overwrite?`))) {
        $('#saveSpinner').show()
        let response = await $.ajax({
            method: 'post',
            url: '/api/credentials',
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(credential)
        })
        $('#saveSpinner').hide()
    
        refreshCredentials()
        $('#credentialCreate').fadeOut(200)
    }
}

let matchesTemplate = credential => {
    let mismatches = []
    _.each(Object.keys(template), tk => {
        if (!credential[tk]) {
            mismatches.push(tk)
        }
    })
    return mismatches
}

let getProjectKeyFromScopes = () => {
    let scopes = $('#field_scopes').val().split(' ')
    let scope = _.first(scopes)
    let [permission, project] = scope.split(':')
    return project
}

let findTemplateKey = key => {
    let keys = []
    _.each(Object.keys(template), tk => {
        keys.push({ key: tk, distance: levenshtein(key, tk) })
    })
    keys = _.sortBy(keys, 'distance')
    let closest = _.first(keys)
    if (closest.distance <= 3) {
        return closest.key
    }
    else {
        return null
    }
}

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    var matrix = [];

    // increment along the first column of each row
    var i;
    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    var j;
    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1)); // deletion
            }
        }
    }

    return matrix[b.length][a.length];
}

$(document).on('click', '.btn-close', function() {
    let e = $(this).closest('.modal')
    e.fadeOut(200)
})

$(document).on('keyup paste', '#pastedCredentials', () => {
    setTimeout(() => {
        parseCredentialPaste()
    }, 100)
})

$(document).ready(async () => {
    $('#saveSpinner').hide()
})
